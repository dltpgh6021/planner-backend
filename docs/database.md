erDiagram
    USERS ||--o{ TODOS : "작성 (1:N)"
    USERS ||--o{ ROUTINES : "소유 (1:N)"
    USERS ||--o{ DIARIES : "기록 (1:N)"
    ROUTINES ||--o{ ROUTINE_ITEMS : "포함 (1:N)"
    ROUTINES ||--o{ ROUTINE_SCHEDULES : "반복 요일 (1:N)"
    ROUTINE_ITEMS ||--o{ ROUTINE_COMPLETIONS : "완료 기록 (1:N)"
    USERS ||--o{ ROUTINE_COMPLETIONS : "완료 기록 (1:N)"

    USERS {
        uuid id PK "내부 관리용 고유 키"
        string google_id UK "구글 고유 식별자"
        string email "사용자 이메일"
        string username "사용자 이름"
    }
    
    TODOS {
        uuid id PK
        uuid user_id FK "USERS 참조"
        string title
        text content
        boolean is_completed
        date target_date
        timestamp created_at
    }
    
    ROUTINES {
        uuid id PK
        uuid user_id FK "USERS 참조"
        string routine_name
        text description
        timestamp created_at
    }
    
    ROUTINE_ITEMS {
        uuid id PK
        uuid routine_id FK "ROUTINES 참조"
        string title
        int list_order
    }
    
    ROUTINE_SCHEDULES {
        uuid routine_id PK,FK "ROUTINES 참조"
        int day_of_week PK "0(일)~6(토) 등 요일 값"
    }
    
    DIARIES {
        uuid id PK
        uuid user_id FK "USERS 참조"
        text content
        date target_date
        timestamp created_at
    }

    ROUTINE_COMPLETIONS {
    uuid id PK
    uuid user_id FK "USERS 참조"
    uuid routine_item_id FK "ROUTINE_ITEMS 참조"
    date completed_date "완료한 날짜"
    timestamp created_at
    }