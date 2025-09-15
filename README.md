# Local Online Judge

A comprehensive web-based competitive programming platform for hosting local contests and managing programming problems. This system provides a complete online judge experience with user management, contest organization, problem submission, and real-time grading.

## ⚠️ Security Warning

**Important:** This system executes user-submitted code directly on the server without sandboxing. Only use this on trusted networks with trusted participants. Do not expose this system to the public internet without proper security measures.

## Features

### 🏆 Contest Management
- Create and manage programming contests with start/end times
- Register participants for contests
- Real-time scoreboards with penalty calculations
- Support for both contest-specific and public problems

### 📝 Problem Management
- Create and edit programming problems with rich text statements
- Upload test cases via files or direct text input
- Configure time and memory limits per problem
- Bulk import test cases from zip files
- Support for large input/output files

### 💻 Code Submission & Grading
- **Supported Languages:** C++ (with g++ compiler)
- Real-time code compilation and execution
- Detailed test case results and scoring
- Submission history and status tracking
- Compile error reporting

### 👥 User System
- User registration and authentication
- Role-based access control (admin/user/banned)
- Secure password hashing with bcrypt
- Session management

### 🎯 Admin Panel
- Complete problem and contest management
- User administration
- Test case management with file uploads
- Bulk operations for contest setup

## Technology Stack

- **Backend:** Node.js, Express.js
- **Database:** MySQL/MariaDB
- **Template Engine:** Nunjucks
- **Frontend:** Semantic UI, jQuery
- **Authentication:** bcrypt, express-session
- **File Handling:** multer for uploads

## Installation

### Prerequisites

- Node.js (v14 or higher recommended)
- MySQL or MariaDB database server
- g++ compiler (for C++ code execution)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CuteMurasame/local-online-judge.git
   cd local-online-judge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the database:**
   ```bash
   # Create database and user (adjust credentials as needed)
   mysql -u root -p < init_db.sql
   ```

4. **Configure environment variables (optional):**
   ```bash
   export DB_HOST=127.0.0.1
   export DB_USER=root
   export DB_PASSWORD=your_password
   export DB_NAME=cp_platform
   export SESSION_SECRET=your-secure-session-secret
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`

## Configuration

The application supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `127.0.0.1` | MySQL database host |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | `` | MySQL password |
| `DB_NAME` | `cp_platform` | MySQL database name |
| `SESSION_SECRET` | `please-change-me` | Session encryption secret |
| `PORT` | `3000` | Server port |

## Usage Guide

### For Administrators

1. **Create an admin account:**
   - Register a regular user account
   - Manually update the database to set role to 'admin'
   ```sql
   UPDATE users SET role = 'admin' WHERE username = 'your_username';
   ```

2. **Create problems:**
   - Navigate to Admin → Problems
   - Click "Create New Problem"
   - Set title, statement, time/memory limits, and scoring
   - Add test cases by uploading files or entering text

3. **Set up contests:**
   - Navigate to Admin → Contests
   - Create a new contest with start/end times
   - Add problems to the contest
   - Participants can register once the contest is created

### For Participants

1. **Register an account** on the platform
2. **Browse available contests** on the home page
3. **Register for contests** you want to participate in
4. **Submit solutions** during the contest period
5. **View results** and scoreboard in real-time

## Database Schema

The system uses the following main tables:

- `users` - User accounts and roles
- `problems` - Problem definitions and metadata
- `testcases` - Test case files and data
- `contests` - Contest information and timing
- `contest_problems` - Problem-contest associations
- `submissions` - Code submissions and results
- `attempts` - Submission attempts for scoring
- `registrations` - Contest participant registrations

## API Routes

### Public Routes
- `GET /` - Home page with contests and problems
- `GET /login` - Login page
- `POST /login` - User authentication
- `GET /register` - Registration page (if implemented)
- `GET /logout` - User logout

### Contest Routes
- `GET /contests/:id` - Contest details
- `POST /contests/:id/register` - Register for contest
- `GET /contest/:cid/problem/:pid` - Contest problem view
- `GET /contests/:id/scoreboard` - Contest scoreboard

### Admin Routes
- `GET /admin/problems` - Problem management
- `GET /admin/problems/create` - Create new problem
- `POST /admin/problems/create` - Save new problem
- `GET /admin/problems/:id` - Edit problem
- `POST /admin/problems/:id/edit` - Update problem
- `POST /admin/problems/:id/add_test` - Add test case
- `GET /admin/contests` - Contest management
- `POST /admin/contests/create` - Create new contest

### Submission Routes
- `POST /submit` - Submit solution
- `GET /submission/:id` - View submission details
- `GET /submissions` - List user submissions

## File Structure

```
local-online-judge/
├── server.js              # Main application server
├── package.json           # Node.js dependencies
├── init_db.sql           # Database schema
├── static/
│   └── style.css         # Custom styles
├── views/                # Nunjucks templates
│   ├── layout.njk        # Base template
│   ├── index.njk         # Home page
│   ├── admin_*.njk       # Admin interfaces
│   ├── contest_*.njk     # Contest pages
│   └── problem_*.njk     # Problem pages
├── data/
│   └── testcases/        # Test case files (created automatically)
└── uploads/              # Temporary upload directory
```

## Development

### Adding New Languages

To add support for additional programming languages:

1. Modify the language detection logic in `server.js`
2. Add compilation and execution commands for the new language
3. Update the submission form to include the new language option
4. Test thoroughly with sample submissions

### Extending Features

Common extensions might include:
- Dockerized execution environment for better security
- Additional programming language support
- More sophisticated scoring algorithms
- Team-based contests
- Problem difficulty ratings
- Editorial and solution viewing

## Security Considerations

⚠️ **Critical Security Notes:**

1. **Code Execution:** User code runs directly on the server without sandboxing
2. **Network Security:** Only deploy on trusted networks
3. **Input Validation:** While basic validation exists, additional sanitization may be needed
4. **File System:** Uploaded files are stored locally without advanced security measures
5. **Database:** Use strong passwords and limit database access

### Recommended Security Enhancements

- Implement Docker containers for code execution
- Add rate limiting for submissions
- Implement file type validation for uploads
- Add CSRF protection
- Use HTTPS in production
- Regular security audits

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow Node.js best practices
- Test all new features thoroughly
- Update documentation for new features
- Ensure backward compatibility when possible
- Add proper error handling

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with Express.js and Node.js
- Uses Semantic UI for styling
- Inspired by competitive programming platforms like Codeforces and AtCoder

## Support

For issues, questions, or contributions, please use the GitHub issue tracker or submit a pull request.

---

**Note:** This is a development/educational tool. For production competitive programming platforms, consider using established solutions with proper security measures and sandboxing.
