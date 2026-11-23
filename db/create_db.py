import mysql.connector

from db_config import CONNECTION, DB_NAME

conn = mysql.connector.connect(**CONNECTION)

cursor = conn.cursor()

# 資料庫名稱
dbname = DB_NAME

# ⚠️ 先刪除資料庫（如果存在）
cursor.execute(f"DROP DATABASE IF EXISTS {dbname}")
print("舊資料庫已刪除")

# ✅ 重新建立資料庫
cursor.execute(f"CREATE DATABASE {dbname}")
print("資料庫重新建立成功！")

cursor.execute(f"USE {dbname}")

# -------------------------
# 學生
cursor.execute("""
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    student_id VARCHAR(100) UNIQUE,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# 老師
cursor.execute("""
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    teacher_id VARCHAR(100) UNIQUE,
    department VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# admin
cursor.execute("""
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    admin_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# 課堂
cursor.execute("""
CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    course_code VARCHAR(20) UNIQUE,
    description TEXT,
    academic_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# 學生選課
cursor.execute("""
CREATE TABLE IF NOT EXISTS enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    course_id INT,
    role VARCHAR(50) DEFAULT 'student',
    withdrawn_at DATETIME NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 老師開課
cursor.execute("""
CREATE TABLE IF NOT EXISTS teacher_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT,
    course_id INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 作業
cursor.execute("""
CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT,
    title VARCHAR(100),
    description TEXT,
    start_date DATE,
    due_date DATE,
    file_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 作業繳交
cursor.execute("""
CREATE TABLE IF NOT EXISTS submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id INT,
    student_id INT,
    version INT DEFAULT 1,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(255),
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 作業評語
cursor.execute("""
CREATE TABLE IF NOT EXISTS assignment_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT,
    teacher_id INT,
    comment TEXT,
    score INT,
    graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL ON UPDATE CASCADE
)
""")

# 考試
cursor.execute("""
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT,
    exam_name VARCHAR(100),
    content TEXT,
    file_path VARCHAR(255),
    exam_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 考試繳交
cursor.execute("""
CREATE TABLE IF NOT EXISTS exam_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT,
    student_id INT,
    version INT DEFAULT 1,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path VARCHAR(255),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 考試評分
cursor.execute("""
CREATE TABLE IF NOT EXISTS exam_grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT,
    teacher_id INT,
    comment TEXT,
    score INT,
    graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES exam_submissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL ON UPDATE CASCADE
)
""")

# 討論室
cursor.execute("""
CREATE TABLE IF NOT EXISTS discussion_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT,
    room_name VARCHAR(100),
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 討論串（支援回覆）
cursor.execute("""
CREATE TABLE IF NOT EXISTS threads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT,
    parent_thread_id INT DEFAULT NULL,
    student_id INT,
    title VARCHAR(100),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES discussion_rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (parent_thread_id) REFERENCES threads(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE
)
""")

# 權限表
# cursor.execute("""
# CREATE TABLE IF NOT EXISTS roles (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     role_name VARCHAR(50) UNIQUE NOT NULL,
#     description VARCHAR(255)
# )
# """)

# 帳號表
cursor.execute("""
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    role ENUM('student', 'teacher', 'ta', 'admin') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

# 帳號-權限關聯表
# cursor.execute("""
# CREATE TABLE IF NOT EXISTS account_roles (
#     id INT AUTO_INCREMENT PRIMARY KEY,
#     account_id INT,
#     role_id INT,
#     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#     FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE ON UPDATE CASCADE,
#     FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE
# )
# """)

# 課程公告
cursor.execute("""
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    teacher_id INT,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (course_id) REFERENCES courses(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE SET NULL ON UPDATE CASCADE
)
""")

# 課程公告是否讀過
cursor.execute("""
CREATE TABLE IF NOT EXISTS announcement_reads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    announcement_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_read (student_id, announcement_id),

    FOREIGN KEY (student_id) REFERENCES students(id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
        ON DELETE CASCADE ON UPDATE CASCADE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(50) NULL,
    homework_id VARCHAR(50) NULL,
    user_id VARCHAR(100) NULL,
    user_name VARCHAR(100) NULL,
    role VARCHAR(20) NULL,
    event_type VARCHAR(50) NOT NULL,
    page_url VARCHAR(500) NOT NULL,
    target_element VARCHAR(255) NULL,
    action_data JSON NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(500) NULL,
    client_timestamp DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_time (user_id, created_at),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at),
    INDEX idx_course_hw (course_code, homework_id, created_at)
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS course_activity_configs (
    course_code VARCHAR(50) PRIMARY KEY,
    enabled TINYINT(1) NOT NULL DEFAULT 0,
    track_clicks TINYINT(1) NOT NULL DEFAULT 0,
    track_file_uploads TINYINT(1) NOT NULL DEFAULT 0,
    track_inputs TINYINT(1) NOT NULL DEFAULT 0,
    track_copy_violations TINYINT(1) NOT NULL DEFAULT 0,
    input_interval_seconds INT NOT NULL DEFAULT 30,
    student_visible TINYINT(1) NOT NULL DEFAULT 0,
    anomaly_detection_enabled TINYINT(1) NOT NULL DEFAULT 1,
    max_chars_per_second INT NOT NULL DEFAULT 15,
    check_frequency_anomaly TINYINT(1) NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
""")

print("所有資料表建立完成！")

cursor.close()
conn.close()


