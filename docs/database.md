erDiagram
    USERS ||--o{ TODOS : "작성 (1:N)"
    USERS ||--o{ ROUTINES : "소유 (1:N)"
    USERS ||--o{ DIARIES : "기록 (1:N)"
    ROUTINES ||--o{ ROUTINE_ITEMS : "포함 (1:N)"
    ROUTINES ||--o{ ROUTINE_SCHEDULES : "반복 요일 (1:N)"

    USERS {
        uuid id PK           // 내부 관리용 고유 키 (UUID)
        string google_id UK  // 구글에서 넘겨주는 고유 식별자 (Unique)
        string email         // 사용자 이메일
        string username      // 사용자 이름
    }
    TODOS {
        uuid id PK
        uuid user_id FK      // USERS(id)를 참조
        string title
        text content
        boolean is_completed
        date target_date
        timestamp created_at
    }
    ROUTINES {
        uuid id PK
        uuid user_id FK      // USERS(id)를 참조
        string routine_name
        text description
        timestamp created_at
    }
    ROUTINE_ITEMS {
        uuid id PK
        uuid routine_id FK
        string title
        int list_order
    }
    ROUTINE_SCHEDULES {
        uuid routine_id PK, FK
        int day_of_week PK
    }
    DIARIES {
        uuid id PK
        uuid user_id FK      // USERS(id)를 참조
        text content
        date target_date
        timestamp created_at
    }