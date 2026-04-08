erDiagram
    USERS ||--o{ TODOS : "작성 (1:N)"
    USERS ||--o{ ROUTINES : "소유 (1:N)"
    USERS ||--o{ DIARIES : "기록 (1:N)"
    ROUTINES ||--o{ ROUTINE_ITEMS : "포함 (1:N)"
    ROUTINES ||--o{ ROUTINE_SCHEDULES : "반복 요일 (1:N)"

    USERS {
        uuid id PK
        string username
        string email
        timestamp created_at
        string google_id
    }
    TODOS {
        uuid id PK
        uuid user_id FK
        string title
        text content
        date target_date
        boolean is_completed
        timestamp created_at
    }
    ROUTINES {
        uuid id PK
        uuid user_id FK
        string name
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
        uuid routine_id FK
        string day_of_week
    }
    DIARIES {
        uuid id PK
        uuid user_id FK
        text content
        date created_at
    }