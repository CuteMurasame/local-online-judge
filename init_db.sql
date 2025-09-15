CREATE DATABASE IF NOT EXISTS cp_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cp_platform;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user','banned') NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS problems (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255),
  statement TEXT,
  timelimit_ms INT DEFAULT 2000,
  memlimit_kb INT DEFAULT 65536,
  score INT DEFAULT 100,
  visibility ENUM('public','contest') NOT NULL DEFAULT 'public'
);

-- Testcases now store paths to files (for large input/output)
CREATE TABLE IF NOT EXISTS testcases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  problem_id VARCHAR(100),
  input_path VARCHAR(512),    -- server-relative path
  output_path VARCHAR(512),   -- server-relative path
  input_name VARCHAR(255),    -- original filename (optional)
  output_name VARCHAR(255),
  input_size BIGINT,
  output_size BIGINT,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  start_ts BIGINT,
  end_ts BIGINT
);

CREATE TABLE IF NOT EXISTS contest_problems (
  contest_id INT,
  problem_id VARCHAR(100),
  ordinal INT,
  PRIMARY KEY (contest_id, problem_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  contest_id INT,
  user_id INT,
  unrated TINYINT DEFAULT 1,
  PRIMARY KEY (contest_id, user_id),
  FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  contest_id INT,
  problem_id VARCHAR(100),
  language VARCHAR(50),
  source MEDIUMTEXT,
  status VARCHAR(50),
  score INT,
  created_ts BIGINT,
  runtime_ms INT,
  message TEXT,
  result_json LONGTEXT,
  compile_error TINYINT DEFAULT 0,
  compile_output TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contest_id INT,
  user_id INT,
  problem_id VARCHAR(100),
  submission_id INT,
  is_ac TINYINT,
  is_compile_error TINYINT DEFAULT 0,
  created_ts BIGINT
);

