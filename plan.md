

# **Higgsfield Automator 크롬 익스텐션 개발 계획서**

## **1\. Higgsfield Automator 아키텍처 설계**

Higgsfield Automator 익스텐션의 성공적인 개발과 장기적인 유지보수를 위해서는 견고하고 확장 가능한 아키텍처를 수립하는 것이 무엇보다 중요합니다. 크롬 익스텐션의 각 컴포넌트가 독립적인 생명주기를 가지는 특성을 고려하여, 본 계획서는 명확한 관심사 분리(Separation of Concerns) 원칙에 기반한 3-티어 아키텍처를 제안합니다. 이 아키텍처는 각 컴포넌트의 역할을 명확히 정의하고, 데이터 흐름을 체계적으로 관리하여 시스템의 안정성과 예측 가능성을 극대화하는 것을 목표로 합니다.

### **1.1. 핵심 컴포넌트 및 역할**

애플리케이션은 UI, 오케스트레이션, 상호작용이라는 세 가지 논리적 계층으로 분리됩니다. 각 계층은 독립적인 컴포넌트로 구현되어 개발, 테스트, 유지보수의 복잡성을 현저히 낮춥니다.

* **Popup (UI 계층)**: 사용자와의 주된 상호작용 지점입니다. React와 TypeScript로 구현되며, 사용자가 프롬프트 목록과 이미지 생성 개수를 입력하고 자동화 작업의 실시간 상태를 확인하는 인터페이스를 제공합니다. Popup은 본질적으로 일시적(ephemeral)입니다. 즉, 사용자가 Popup 외부를 클릭하면 창이 닫히고 내부 상태가 소멸됩니다.1 따라서 Popup은 열릴 때마다 영속적인 데이터 소스로부터 현재 상태를 가져와 UI를 초기화하도록 설계되어야 합니다.  
* **Background Service Worker (오케스트레이션 계층)**: 익스텐션의 영구적인 '두뇌' 역할을 수행합니다. Manifest V3 표준에 따라 이벤트 기반으로 동작하며, 일정 시간 동안 활동이 없으면 크롬에 의해 휴면 상태로 전환될 수 있습니다.1 이 서비스 워커의 핵심 책임은 다음과 같습니다.  
  * 전체 작업 큐(대기, 진행 중, 완료)의 최종 상태를 유지하고 관리합니다.  
  * Higgsfield 서비스의 비즈니스 규칙(총 40장 이미지 제한, 최대 2개 동시 배치 작업)을 강제합니다.  
  * Popup과 Content Script 간의 모든 통신을 중재하는 중앙 메시지 브로커 역할을 합니다.  
* **Content Script (상호작용 계층)**: Higgsfield 웹 페이지의 DOM에 직접 주입되는 TypeScript 모듈입니다. 자동화 작업의 '손과 발'에 해당하며, 그 책임은 명확하게 제한됩니다.  
  * Higgsfield 페이지의 DOM을 감시하여 상태 변화(예: '생성 완료')를 감지합니다.  
  * 프로그래밍 방식으로 입력 필드(프롬프트, 이미지 비율, 해상도)를 채우고 '생성' 버튼을 클릭합니다.  
  * 발생하는 모든 이벤트와 상태 변화를 Background Service Worker에 보고합니다.

이러한 구조는 각 컴포넌트가 자신의 책임 영역에만 집중하도록 강제합니다. 예를 들어, Content Script는 절대로 작업 큐의 상태를 직접 수정하지 않으며, 오직 명령을 수행하고 관찰 결과를 보고할 뿐입니다. 이 명확한 역할 분리는 병렬 개발을 용이하게 하고 통합 과정에서 발생할 수 있는 버그를 줄이는 데 결정적인 역할을 합니다.

### **1.2. 데이터 흐름 및 컴포넌트 간 통신 프로토콜**

분리된 컴포넌트 간의 원활한 통신은 익스텐션 기능의 핵심입니다. 이를 위해 크롬이 공식적으로 제공하는 메시징 API를 독점적으로 사용하여 안정적이고 표준화된 통신 채널을 구축합니다.2

* **Popup → Background**: Popup은 사용자의 명령(예: START\_AUTOMATION, PAUSE\_AUTOMATION)을 Background로 전달하기 위해 chrome.runtime.sendMessage()를 사용한 단발성 요청(one-time requests)을 보냅니다. 이 메시지의 페이로드에는 사용자가 정의한 프롬프트 목록과 설정이 포함됩니다.2  
* **Background → Content Script**: Background 워커는 활성화된 Higgsfield 탭의 Content Script에 명령을 내리기 위해 chrome.tabs.sendMessage()를 사용합니다. 명령에는 FILL\_AND\_SUBMIT\_PROMPT와 같은 구체적인 지시와 함께 프롬프트 데이터가 페이로드로 전달됩니다.4  
* **Content Script → Background**: Content Script는 DOM에서 감지한 이벤트를 Background 워커에 보고하기 위해 chrome.runtime.sendMessage()를 사용합니다. 보고되는 이벤트에는 GENERATION\_STARTED, GENERATION\_COMPLETED, ERROR\_ELEMENT\_NOT\_FOUND 등이 포함됩니다.  
* **상태 동기화**: Background 워커는 시스템의 '단일 진실 공급원(Single Source of Truth)' 역할을 합니다. Popup이 열릴 때, 가장 먼저 Background 워커에게 현재 상태를 요청하여 UI를 구성합니다. 이후 실시간 업데이트를 위해서는, Background 워커가 상태를 변경할 때마다 chrome.storage.onChanged 이벤트를 발생시키고, Popup은 이 이벤트를 수신하여 UI를 반응적으로 갱신합니다.6 이 방식은 복잡한 양방향 메시징 없이도 UI를 최신 상태로 유지하는 효율적이고 분리된(decoupled) 구조를 만듭니다.

### **1.3. 상태 관리 전략**

브라우저 재시작이나 Popup 창 닫힘과 같은 상황에서도 자동화 상태를 안정적으로 유지하기 위해서는 견고한 상태 관리 전략이 필수적입니다.

* **영속적 상태 (chrome.storage.local)**: 대기 중, 활성, 완료된 프롬프트를 포함한 전체 작업 큐와 총 생성 이미지 수와 같은 핵심 데이터는 chrome.storage.local에 저장합니다. 이 API는 비동기적으로 작동하며, 익스텐션이 설치되어 있는 동안 데이터를 영구적으로 보존합니다. 또한 최대 10MB의 넉넉한 저장 공간을 제공하여 본 프로젝트의 요구사항에 완벽하게 부합합니다.1 일반적인 웹 localStorage는 서비스 워커에서 접근할 수 없고 사용자가 브라우징 데이터를 삭제할 때 함께 지워질 수 있으므로 사용이 권장되지 않습니다.6  
* **인메모리 상태 (Background Worker)**: 현재 활성화된 생성 슬롯의 ID와 같이 일시적인 상태 정보는 Background 워커의 메모리 내에 변수로 유지합니다. 이 데이터는 영속성이 필요 없지만, 동시성 제어와 같은 실시간 로직 처리에 필수적입니다.  
* **UI 상태 (React)**: Popup의 UI 상태는 useState, useReducer와 같은 표준 React 상태 관리 훅을 사용하여 관리합니다. 이 UI 상태는 Popup이 열릴 때마다 chrome.storage.local에 저장된 영속적 상태를 기반으로 초기화되고 동기화됩니다. 이는 React 기반 익스텐션의 효과적인 상태 관리 모범 사례를 따르는 것입니다.7

#### **표 1: 컴포넌트 책임 매트릭스**

| 책임 영역 | Popup (UI 계층) | Background Service Worker (오케스트레이션 계층) | Content Script (상호작용 계층) |
| :---- | :---- | :---- | :---- |
| **UI/UX** | 사용자 입력(프롬프트 목록, 설정) 처리, 자동화 상태 및 진행률 시각화 | 없음 | 없음 |
| **상태 관리** | 일시적인 UI 상태 관리. 영속적 상태는 Background로부터 수신하여 표시 | 모든 영속적 상태(작업 큐, 설정)의 '단일 진실 공급원'. chrome.storage.local에 대한 유일한 쓰기 권한 보유 | 상태를 관리하지 않음. 오직 명령에 따라 행동하고 결과를 보고 |
| **비즈니스 로직** | 사용자 입력 유효성 검사 | 작업 스케줄링, Higgsfield 규칙(이미지 한도, 동시 작업 수) 강제, 상태 전환 로직 처리 | 없음 |
| **DOM 상호작용** | 없음 | 없음 | Higgsfield 페이지의 DOM 요소 식별, 입력 필드 채우기, 버튼 클릭, MutationObserver를 통한 DOM 변화 감지 |
| **통신** | sendMessage를 통해 Background에 사용자 명령 전송. storage.onChanged를 통해 상태 업데이트 수신 | 모든 컴포넌트 간의 메시지 중재. Popup과 Content Script로부터 메시지 수신 및 명령 전송 | sendMessage를 통해 Background에 DOM 이벤트 보고. Background로부터 명령 수신 |

## **2\. 단계별 구현 로드맵**

프로젝트를 논리적인 단계로 나누어 점진적으로 기능을 완성하고, 각 단계마다 테스트를 통해 안정성을 확보하는 반복적인 개발 방식을 채택합니다.

### **2.1. 1단계: 프로젝트 구조화 및 환경 설정**

* **목표**: 올바른 프로젝트 구조와 빌드 구성을 갖춘 기능적인 "Hello World" 익스텐션을 생성합니다.  
* **세부 단계**:  
  1. Vite와 react-ts 템플릿을 사용하여 새 프로젝트를 초기화합니다: npm create vite@latest higgsfield-automator \-- \--template react-ts.8  
  2. Tailwind CSS를 설치하고 tailwind.config.js 및 postcss.config.js 파일을 구성하여 스타일링 환경을 구축합니다.9  
  3. 익스텐션의 청사진인 manifest.json 파일을 생성합니다. manifest\_version: 3, 이름, 설명, 아이콘을 정의하고 필요한 권한(storage, scripting)을 명시합니다. 또한 action(Popup용), background 서비스 워커, content\_scripts를 선언합니다.9  
  4. vite.config.ts 파일을 구성합니다. 이 단계는 매우 중요합니다. 에셋의 상대 경로를 보장하기 위해 base: './'를 설정하고, build.rollupOptions를 조정하여 manifest 파일이 참조할 수 있도록 해시값이 없는 깔끔한 파일 이름으로 빌드 결과물이 생성되도록 합니다.9 또한 background 및 content script를 위한 별도의 진입점(entry point)을 설정해야 합니다.11  
  5. chrome://extensions 페이지에서 '압축 해제된 확장 프로그램을 로드합니다' 기능을 사용하여 빌드된 dist 디렉토리를 로드하고 기본 설정이 정상적으로 작동하는지 확인합니다.8

### **2.2. 2단계: UI/UX 구현 (Popup 컴포넌트)**

* **목표**: 프롬프트 큐를 관리하기 위한 완전한 기능의 사용자 인터페이스를 구축합니다.  
* **세부 단계**:  
  1. TypeScript와 Tailwind CSS를 사용하여 Popup UI를 위한 React 컴포넌트들을 개발합니다. 여기에는 프롬프트 입력을 위한 텍스트 영역, 프롬프트당 이미지 개수 입력 필드, "시작", "일시정지", "초기화" 버튼 등이 포함됩니다.  
  2. 사용자 입력을 파싱하여 작업 큐 배열(예: \[{ prompt: 'A cat...', count: 4, status: 'pending' },...\])로 구조화하는 로직을 구현합니다.  
  3. UI를 chrome.storage.local과 연결합니다. Popup이 열리면 스토리지에서 기존 큐를 읽어와 UI를 채웁니다. "시작" 버튼을 클릭하면 새로운 큐를 스토리지에 저장하고 Background 워커에 메시지를 보냅니다.  
  4. 자동화의 현재 상태("대기 중", "실행 중", "완료")와 진행 상황("40개 중 15개 이미지 생성됨")을 표시하는 영역을 구현합니다. 이 정보는 chrome.storage.local의 데이터를 기반으로 렌더링됩니다.

### **2.3. 3단계: 핵심 자동화 로직 (Content Script)**

* **목표**: Higgsfield 웹 페이지와 안정적으로 상호작용할 수 있는 스크립트를 작성합니다.  
* **세부 단계**:  
  1. Higgsfield 페이지의 핵심 HTML 요소(프롬프트 텍스트 영역, 비율 선택기, 해상도 스위치, "생성" 버튼, 두 개의 생성 슬롯 상태 표시기)를 식별하는 로직을 개발합니다.  
  2. Background 워커로부터의 명령을 기다리는 메시지 리스너(chrome.runtime.onMessage)를 구현합니다.2  
  3. FILL\_AND\_SUBMIT\_PROMPT 명령을 수신하면, 스크립트는 프로그래밍 방식으로 양식 필드를 채우고 생성 버튼을 클릭합니다.  
  4. 생성 슬롯을 감싸는 컨테이너 요소를 감시하기 위해 MutationObserver를 구현합니다. 이는 이 단계에서 가장 중요한 부분입니다.13 옵저버는 특정 슬롯의 상태가 "생성 중"에서 "완료"로 변경되는 것을 감지하도록 구성됩니다.13  
  5. MutationObserver가 작업 완료를 감지하면, Content Script는 GENERATION\_COMPLETED 메시지를 Background 워커에 전송하며, 어떤 슬롯이 비었는지에 대한 정보를 포함합니다.

### **2.4. 4단계: 오케스트레이션 및 상태 영속성 (Background Service Worker)**

* **목표**: 작업 큐를 관리하고 서비스 규칙을 강제하는 중앙 컨트롤러를 구축합니다.  
* **세부 단계**:  
  1. Popup과 Content Script로부터의 명령 및 이벤트를 처리하기 위한 메시지 리스너(chrome.runtime.onMessage)를 생성합니다.2  
  2. 핵심 작업 스케줄링 로직을 구현합니다. 이 "스케줄러"는 작업이 완료되거나 "시작" 명령을 수신할 때마다 트리거됩니다.  
  3. 스케줄러는 다음 조건들을 순차적으로 확인합니다:  
     * chrome.storage.local에서 읽어온 작업 큐에 대기 중인 프롬프트가 있는가?  
     * 총 생성된 이미지 수가 40개 미만인가?  
     * 사용 가능한 생성 슬롯이 있는가 (활성 작업이 2개 미만인가)?  
  4. 모든 조건이 충족되면, 큐에서 다음 프롬프트를 가져와 chrome.storage.local에 있는 상태를 "active"로 업데이트하고, FILL\_AND\_SUBMIT\_PROMPT 메시지를 Content Script에 전송합니다.  
  5. 프롬프트 상태 변경, 총 이미지 수 증가 등 모든 상태 수정 작업은 chrome.storage.local에 기록됩니다. 이를 통해 모든 상태 변화가 영속적으로 저장되고, UI 업데이트를 위한 onChanged 이벤트가 트리거됩니다.

### **2.5. 5단계: 통합, 테스트 및 개선**

* **목표**: 모든 컴포넌트가 원활하게 함께 작동하고 예외 상황을 적절히 처리하는지 확인합니다.  
* **세부 단계**:  
  1. 전체 워크플로우(프롬프트 입력, 자동화 시작, 프로세스 관찰, 최종 완료 상태 확인)에 대한 엔드투엔드 테스트를 수행합니다.  
  2. 예외 상황을 테스트합니다: 사용자가 Higgsfield 탭을 닫는 경우, 페이지를 새로고침하는 경우, Higgsfield에서 오류가 발생하는 경우 등을 테스트하고 익스텐션이 이러한 시나리오를 우아하게 처리하는지 확인합니다.  
  3. Content Script의 DOM 선택자를 최대한 안정적으로 개선합니다.  
  4. MutationObserver의 성능을 검토하여 Higgsfield 페이지에 눈에 띄는 속도 저하를 유발하지 않는지 확인합니다.14

## **3\. 기술 심층 분석 및 구현 상세**

이 섹션에서는 프로젝트의 가장 복잡한 기술적 과제들을 해결하기 위한 구체적인 구현 패턴과 세부 사항을 다룹니다.

### **3.1. MutationObserver를 활용한 DOM 상호작용 마스터링**

Higgsfield 웹사이트는 거의 확실하게 단일 페이지 애플리케이션(SPA)으로 구현되어 있을 것입니다. 이러한 환경에서는 기존의 DOM 조작 및 이벤트 리스닝 방식만으로는 동적으로 변화하는 콘텐츠를 안정적으로 처리하기 어렵습니다. MutationObserver API는 이러한 비동기적 변화를 감지하기 위한 현대적이고 성능이 뛰어난 해결책입니다.13

* **구현 전략**:  
  1. Content Script에서 먼저 두 개의 이미지 생성 배치 슬롯을 포함하는 상위 컨테이너 요소를 정확히 식별합니다.  
  2. 콜백 함수와 함께 MutationObserver 인스턴스를 생성합니다.  
  3. 옵저버는 해당 컨테이너 내부의 childList(자식 노드 추가/제거)와 subtree(하위 모든 노드의 변경) 변화를 감시하도록 구성합니다. 성능 저하를 피하기 위해 감시 범위를 최대한 구체적으로 지정하는 것이 중요합니다.14  
  4. 콜백 함수는 전달된 mutationList를 분석하여 작업 완료를 나타내는 특정 변화를 찾습니다. 예를 들어, "다운로드" 버튼의 출현, "로딩 중" 스피너의 사라짐, 또는 특정 요소의 data-status 속성 값 변경 등이 감지 대상이 될 수 있습니다.  
  5. 이 접근 방식은 비효율적이고 반응성이 떨어지는 setInterval을 사용한 폴링(polling) 방식보다 월등히 우수합니다.

### **3.2. chrome.storage 내 복원력 있는 작업 큐 설계**

chrome.storage.local에 저장될 상태 객체는 시스템의 단일 진실 공급원이므로, 그 구조는 명확하고 일관성 있게 정의되어야 합니다.

* **제안 스키마 (TypeScript 인터페이스)**:  
  TypeScript  
  interface GenerationJob {  
    id: string;  
    prompt: string;  
    imagesToGenerate: number;  
    imagesCompleted: number;  
    status: 'pending' | 'active' | 'completed' | 'error';  
    error?: string;  
  }

  interface AppState {  
    jobs: GenerationJob;  
    totalImagesGenerated: number;  
    automationStatus: 'idle' | 'running' | 'paused' | 'complete';  
    activeSlots: { slotId: 1 | 2; jobId: string };  
  }

* 이 구조는 프롬프트별 진행 상황과 전체 진행 상황을 모두 추적할 수 있게 해줍니다. activeSlots 정보를 함께 저장함으로써, Background 워커는 GENERATION\_COMPLETED 메시지를 수신했을 때 어떤 슬롯이 비었는지를 신속하게 파악하고 다음 작업을 할당할 수 있습니다.

### **3.3. 컴포넌트 간 메시징 스키마 정의**

버그를 예방하고 디버깅을 용이하게 하기 위해, 컴포넌트 간에 전달되는 모든 메시지에 대한 엄격한 규약을 정의합니다. 이는 각 컴포넌트의 API를 명확히 하고, TypeScript의 타입 시스템을 통해 컴파일 시점에 오류를 발견할 수 있게 해주는 중요한 과정입니다.

#### **표 2: 메시지 프로토콜 정의**

| 메시지 타입 | 소스 | 목적지 | 페이로드 스키마 | 설명 |
| :---- | :---- | :---- | :---- | :---- |
| START\_AUTOMATION | Popup | Background | { jobs: GenerationJob } | 사용자가 자동화 시작 버튼을 클릭했을 때 전송. |
| PAUSE\_AUTOMATION | Popup | Background | null | 자동화 일시 중지를 요청. |
| CLEAR\_QUEUE | Popup | Background | null | 모든 작업 큐를 초기화. |
| GET\_CURRENT\_STATE | Popup | Background | null | Popup이 열릴 때 현재 상태를 요청. |
| FILL\_AND\_SUBMIT\_PROMPT | Background | Content Script | { job: GenerationJob, slotId: 1 | 2 } | 특정 슬롯에 프롬프트를 입력하고 생성을 시작하라는 명령. |
| GENERATION\_STARTED | Content Script | Background | { jobId: string, slotId: 1 | 2 } | 생성 작업이 성공적으로 시작되었음을 보고. |
| GENERATION\_COMPLETED | Content Script | Background | { jobId: string, slotId: 1 | 2 } | 특정 슬롯의 생성 작업이 완료되었음을 보고. |
| ERROR\_OCCURRED | Content Script | Background | { jobId?: string, message: string } | DOM 요소 찾기 실패 등 Content Script에서 오류 발생 시 보고. |

이처럼 정형화된 프로토콜은 세 개의 독립적인 스크립트가 혼란 없이 상호작용하는 기반이 됩니다. 이는 Redux와 같은 현대 프론트엔드 프레임워크에서 차용한 단방향 데이터 흐름(Unidirectional Data Flow) 패턴을 크롬 익스텐션 환경에 적용한 것입니다. 모든 상태 변경은 Background 워커를 통해서만 이루어지도록 강제함으로써, 여러 컴포넌트가 동시에 상태를 수정하려 할 때 발생하는 경쟁 조건(race condition)을 원천적으로 방지하고, 시스템 전체를 예측 가능하고 디버깅하기 쉬운 상태 머신으로 만듭니다.

## **4\. 리스크 분석 및 전략적 고려사항**

프로젝트의 성공과 지속 가능성을 보장하기 위해 잠재적인 도전 과제, 구현 난이도, 그리고 반드시 준수해야 할 모범 사례들을 사전에 분석하고 대비합니다.

### **4.1. 구현 난이도 평가**

* **Popup (난이도: 하)**: 표준적인 React 애플리케이션 개발에 해당합니다. Chrome API와의 연동이 주된 복잡성이지만, 관련 문서가 잘 정리되어 있어 큰 어려움은 없습니다.8  
* **Background Worker (난이도: 중)**: 작업 스케줄러 로직은 비동기 작업과 상태 관리를 신중하게 처리해야 합니다. 또한 서비스 워커의 디버깅은 일반적인 웹 개발보다 직관적이지 않을 수 있습니다.  
* **Content Script (난이도: 상)**: 프로젝트에서 가장 취약하고 복잡한 부분입니다. 기능의 성공 여부가 전적으로 외부 웹사이트의 구조에 의존하기 때문입니다. DOM, 이벤트 처리, MutationObserver API에 대한 깊은 이해가 요구됩니다.

### **4.2. "취약한 스크레이퍼" 리스크 및 완화 전략**

* **리스크**: 가장 큰 리스크는 Higgsfield 개발팀이 웹사이트의 HTML, CSS, 또는 JavaScript를 업데이트하여 현재 사용 중인 DOM 선택자가 더 이상 유효하지 않게 되는 것입니다. 이 경우 익스텐션은 즉시 작동을 멈추게 됩니다.  
* **완화 전략**:  
  1. **시맨틱하고 데이터 기반의 선택자 우선 사용**: .css-123xyz와 같이 자동으로 생성된 클래스 이름에 의존하는 대신, id, name, ARIA 속성(role="button"), 또는 data-testid와 같이 변경될 가능성이 낮은 속성을 기반으로 선택자를 작성합니다.  
  2. **하드코딩 대신 설정 파일 사용**: 모든 DOM 선택자를 Content Script 상단의 설정 객체에 저장합니다. 이를 통해 향후 선택자 변경이 필요할 때 코드 전체를 헤매지 않고 한 곳에서 쉽게 수정할 수 있습니다.  
  3. **견고한 오류 처리**: Content Script는 특정 요소가 항상 존재한다고 가정해서는 안 됩니다. 모든 querySelector 호출 결과는 null인지 확인해야 합니다. 만약 필수적인 요소를 찾지 못하면, 스크립트는 Background 워커에 ERROR 메시지를 보내야 하며, Background 워커는 자동화를 일시 중지하고 Popup을 통해 사용자에게 상황을 알려야 합니다.  
  4. **사용자 친화적인 오류 메시지**: Popup은 "생성 버튼을 찾을 수 없습니다. Higgsfield 사이트가 업데이트되었을 수 있습니다. 익스텐션 업데이트를 확인해주세요."와 같이 명확하고 실행 가능한 오류 메시지를 표시해야 합니다.

### **4.3. 동시성 및 비동기 작업 처리**

시스템은 최대 두 개의 동시 생성 작업을 정확하게 관리해야 합니다. 앞서 설명한 단방향 데이터 흐름 패턴은 경쟁 조건을 방지하는 핵심 전략입니다. 모든 상태 변경 요청을 Background 워커를 통해 직렬화함으로써, 상태의 관점에서는 모든 작업이 원자적(atomic)으로 처리됨을 보장할 수 있습니다.

### **4.4. Manifest V3 및 웹 스토어 정책 준수**

* **Manifest V3**: 서비스 워커를 중심으로 설계된 본 아키텍처는 Manifest V3 표준을 완벽하게 준수합니다.1  
* **권한**: 사용자 개인정보를 존중하고 Chrome 웹 스토어 정책을 준수하기 위해 최소한의 필수 권한(storage, scripting)만을 요청할 것입니다.16 광범위한 호스트 권한 대신, higgsfield.com에 대한 좁은 일치 패턴을 사용하거나 activeTab 권한을 활용하여 권한 요청 범위를 최소화합니다.  
* **성능**: 비효율적인 폴링 대신 MutationObserver API를 사용하는 것은 성능 최적화 모범 사례에 부합합니다.14 Content Script가 호스트 페이지의 성능에 미치는 영향을 최소화하도록 주의를 기울일 것입니다.

## **5\. 결론 및 권장 사항**

본 개발 계획서는 Higgsfield 서비스의 이미지 생성 프로세스를 자동화하는 'Higgsfield Automator' 크롬 익스텐션을 개발하기 위한 포괄적인 청사진을 제시합니다. 제안된 3-티어 아키텍처(Popup, Background Service Worker, Content Script)는 크롬 익스텐션의 고유한 환경적 제약을 고려한 최적의 설계입니다.

핵심 성공 요인은 다음과 같이 요약할 수 있습니다.

1. **분리된 아키텍처**: 각 컴포넌트의 역할을 명확히 분리하여 개발 및 유지보수의 복잡성을 낮춥니다.  
2. **중앙 집중식 상태 관리**: Background Service Worker를 '단일 진실 공급원'으로 지정하고, chrome.storage.local을 영속적 상태 저장소로 사용하여 데이터의 일관성과 안정성을 보장합니다.  
3. **단방향 데이터 흐름**: 모든 상태 변경을 Background 워커를 통해 직렬화하는 통신 프로토콜을 수립하여 경쟁 조건과 같은 비동기 처리 문제를 해결합니다.  
4. **안정적인 DOM 상호작용**: 동적인 웹 페이지 변화에 대응하기 위해 MutationObserver를 적극적으로 활용합니다.  
5. **리스크 관리**: 외부 웹사이트 변경이라는 가장 큰 리스크에 대비하여 유연한 선택자 관리와 견고한 오류 처리 메커니즘을 구현합니다.

이 계획서에 명시된 아키텍처 원칙과 단계별 로드맵을 충실히 따르면, 사용자의 생산성을 크게 향상시킬 수 있는 안정적이고 효율적이며 유지보수가 용이한 고품질의 크롬 익스텐션을 성공적으로 개발할 수 있을 것입니다. 프로젝트 착수 시, 1단계인 환경 설정과 manifest.json 구성부터 시작하여 제안된 로드맵을 순차적으로 진행할 것을 권장합니다.

#### **참고 자료**

1. State Storage in Chrome Extensions: Options, Limits, and Best ..., 10월 17, 2025에 액세스, [https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices](https://hackernoon.com/state-storage-in-chrome-extensions-options-limits-and-best-practices)  
2. Message passing | Chrome for Developers, 10월 17, 2025에 액세스, [https://developer.chrome.com/docs/extensions/develop/concepts/messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)  
3. 5 Understanding Chrome Extensions Communication | by M2K Developments \- Medium, 10월 17, 2025에 액세스, [https://m2kdevelopments.medium.com/5-understanding-chrome-extensions-communication-0b76b3c7958f](https://m2kdevelopments.medium.com/5-understanding-chrome-extensions-communication-0b76b3c7958f)  
4. Send Message from Background Script to Content Script | Chrome Extension 101 | Video 09 | TUTORIEX \- YouTube, 10월 17, 2025에 액세스, [https://www.youtube.com/watch?v=zNswnpCKuzU](https://www.youtube.com/watch?v=zNswnpCKuzU)  
5. Chrome Extension how to send data from content script to popup.html \- Stack Overflow, 10월 17, 2025에 액세스, [https://stackoverflow.com/questions/20019958/chrome-extension-how-to-send-data-from-content-script-to-popup-html](https://stackoverflow.com/questions/20019958/chrome-extension-how-to-send-data-from-content-script-to-popup-html)  
6. chrome.storage | API | Chrome for Developers, 10월 17, 2025에 액세스, [https://developer.chrome.com/docs/extensions/reference/api/storage](https://developer.chrome.com/docs/extensions/reference/api/storage)  
7. Effective State Management in Chrome Extensions | Reintech media, 10월 17, 2025에 액세스, [https://reintech.io/blog/effective-state-management-chrome-extensions](https://reintech.io/blog/effective-state-management-chrome-extensions)  
8. Chrome Extensions using Vite \+ Typescript \+ React: Stepwise ..., 10월 17, 2025에 액세스, [https://singlequote.blog/chrome-extension-using-vite-typescript-react-stepwise-process/](https://singlequote.blog/chrome-extension-using-vite-typescript-react-stepwise-process/)  
9. Building a Chrome Extension with Vite, React, and Tailwind CSS in ..., 10월 17, 2025에 액세스, [https://www.artmann.co/articles/building-a-chrome-extension-with-vite-react-and-tailwind-css-in-2025](https://www.artmann.co/articles/building-a-chrome-extension-with-vite-react-and-tailwind-css-in-2025)  
10. How to Create a Chrome Extension with React, TypeScript, TailwindCSS, and Vite, 10월 17, 2025에 액세스, [https://www.luckymedia.dev/blog/how-to-create-a-chrome-extension-with-react-typescript-tailwindcss-and-vite-in-2024](https://www.luckymedia.dev/blog/how-to-create-a-chrome-extension-with-react-typescript-tailwindcss-and-vite-in-2024)  
11. Tutorial: Chrome Extension Starter Template With Vite React TypeScript and Tailwind CSS, 10월 17, 2025에 액세스, [https://www.youtube.com/watch?v=jwDErziR1nE](https://www.youtube.com/watch?v=jwDErziR1nE)  
12. Make Your First Chrome Extension with React \+ Vite (Insanely Easy\!) \- YouTube, 10월 17, 2025에 액세스, [https://www.youtube.com/watch?v=lmSuEtBtwxI](https://www.youtube.com/watch?v=lmSuEtBtwxI)  
13. MutationObserver \- Web APIs | MDN, 10월 17, 2025에 액세스, [https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)  
14. Run scripts on every page | Get started | Chrome for Developers, 10월 17, 2025에 액세스, [https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-on-every-tab](https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-on-every-tab)  
15. Hacking with DOM MutationObservers | by Fernando Agüero | Building Lang.ai, 10월 17, 2025에 액세스, [https://building.lang.ai/hacking-with-dom-mutationobservers-348a50231580](https://building.lang.ai/hacking-with-dom-mutationobservers-348a50231580)  
16. Best Practices | Chrome Extensions, 10월 17, 2025에 액세스, [https://developer.chrome.com/docs/webstore/best-practices](https://developer.chrome.com/docs/webstore/best-practices)