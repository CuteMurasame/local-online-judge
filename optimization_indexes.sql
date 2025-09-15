-- Performance optimization indexes for better query performance
-- Run these after initial setup to improve database performance

-- Index for user lookups by username (login)
CREATE INDEX idx_users_username ON users(username);

-- Index for submissions by user and contest
CREATE INDEX idx_submissions_user_contest ON submissions(user_id, contest_id);
CREATE INDEX idx_submissions_problem ON submissions(problem_id);
CREATE INDEX idx_submissions_created_ts ON submissions(created_ts);

-- Index for contest problems
CREATE INDEX idx_contest_problems_contest ON contest_problems(contest_id);
CREATE INDEX idx_contest_problems_ordinal ON contest_problems(contest_id, ordinal);

-- Index for registrations
CREATE INDEX idx_registrations_user ON registrations(user_id);

-- Index for attempts
CREATE INDEX idx_attempts_contest_user ON attempts(contest_id, user_id);
CREATE INDEX idx_attempts_problem ON attempts(problem_id);
CREATE INDEX idx_attempts_created_ts ON attempts(created_ts);

-- Index for testcases
CREATE INDEX idx_testcases_problem ON testcases(problem_id);

-- Index for contests by date
CREATE INDEX idx_contests_start_ts ON contests(start_ts);
CREATE INDEX idx_contests_end_ts ON contests(end_ts);