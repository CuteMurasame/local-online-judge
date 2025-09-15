# Local Online Judge

A web-based online judge system for hosting competitive programming contests locally. This platform allows you to create problems, organize contests, and judge submissions in real-time.

⚠️ **SECURITY WARNING**: This application executes submitted code directly on the host system without sandboxing. Only use in trusted environments and consider containerization for production use.

## Features

- **Contest Management**: Create and manage competitive programming contests
- **Problem Management**: Upload problems with custom test cases
- **Real-time Judging**: Automatic compilation and testing of submissions
- **Multiple Languages**: Support for C++, Python, and Node.js
- **User Management**: Registration, authentication, and role-based access
- **Scoreboard**: Live contest rankings and submissions
- **Bulk Import**: Import problems and test cases from external sources

## Quick Start

### Prerequisites

- Node.js 16+ 
- MySQL/MariaDB 5.7+
- C++ compiler (g++) for C++ submissions
- Python 3 for Python submissions

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd local-online-judge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup the database**
   ```bash
   # Create database and tables
   mysql -u root -p < init_db.sql
   
   # Optional: Add performance indexes
   mysql -u root -p < optimization_indexes.sql
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and session secret
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the platform**
   - Open http://localhost:3000
   - Default admin credentials: `admin` / `admin`
   - **Change the admin password immediately!**

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | 127.0.0.1 |
| `DB_USER` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | (empty) |
| `DB_NAME` | Database name | cp_platform |
| `SESSION_SECRET` | Session encryption key | please-change-me |
| `PORT` | Application port | 3000 |
| `MAX_SOURCE_LENGTH` | Max source code length | 50000 |

### Security Configuration

1. **Change default session secret**:
   ```bash
   echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
   ```

2. **Create a dedicated database user**:
   ```sql
   CREATE USER 'judge_user'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON cp_platform.* TO 'judge_user'@'localhost';
   ```

## Usage

### For Administrators

1. **Create Problems**:
   - Go to Admin → Problems → Create New
   - Fill in problem details (title, statement, limits)
   - Upload test cases (input/output files)

2. **Create Contests**:
   - Go to Admin → Contests → Create New
   - Set contest duration and select problems
   - Participants must register to join

### For Participants

1. **Register** for an account
2. **Join contests** by registering for them
3. **Submit solutions** during contest time
4. **View results** on the scoreboard

### Supported Languages

- **C++**: Compiled with `g++ -std=c++26 -O2 -lm -static`
- **Python**: Executed with `python3`
- **Node.js**: Executed with `node`

## File Structure

```
local-online-judge/
├── server.js              # Main application server
├── package.json           # Node.js dependencies
├── init_db.sql            # Database schema
├── optimization_indexes.sql # Performance indexes
├── .env.example           # Environment template
├── static/                # CSS and client-side assets
├── views/                 # Nunjucks templates
├── data/testcases/        # Test case files (auto-created)
└── tmp_runs/              # Temporary execution files (auto-created)
```

## API Endpoints

### Authentication
- `POST /login` - User login
- `POST /register` - User registration
- `GET /logout` - User logout

### Contest Participation
- `GET /contests/:id` - View contest
- `POST /contests/:id/register` - Register for contest
- `GET /contest/:cid/problem/:pid` - View problem in contest
- `POST /contest/:cid/problem/:pid/submit` - Submit solution

### Admin Functions
- `GET /admin/problems` - Manage problems
- `GET /admin/contests` - Manage contests
- `POST /admin/bulk_import/scan` - Scan directory for bulk import

## Development

### Running in Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test  # No tests implemented yet
```

## Security Considerations

⚠️ **CRITICAL**: This application executes user-submitted code without sandboxing.

### Security Risks
- File system access by submitted code
- Network access by submitted code  
- Resource consumption (CPU, memory, disk)
- Potential system compromise

### Recommended Security Measures

1. **Containerization**:
   ```bash
   docker run -d --name online-judge \
     --memory=2g --cpus=1 \
     -v $(pwd):/app \
     -p 3000:3000 \
     node:16-alpine
   ```

2. **User Isolation**:
   - Run the application as a non-privileged user
   - Use `chroot` or similar for filesystem isolation

3. **Resource Limits**:
   - Use `ulimit` to restrict resource usage
   - Implement submission rate limiting

4. **Network Isolation**:
   - Block outgoing network access for judged code
   - Use firewall rules or network namespaces

5. **Monitoring**:
   - Monitor system resources during judging
   - Log all submissions and execution attempts

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service is running
   - Verify database credentials in `.env`
   - Ensure database exists and user has permissions

2. **Compilation Errors**
   - Ensure `g++` is installed and in PATH
   - Check that the user has write permissions in `tmp_runs/`

3. **Permission Denied**
   - Check file permissions on the application directory
   - Ensure the application user can create files in `data/` and `tmp_runs/`

4. **Memory/Performance Issues**
   - Monitor system resources during judging
   - Consider increasing database connection limits
   - Implement submission queuing for high load

### Debug Mode

Set `NODE_ENV=development` for verbose logging:
```bash
NODE_ENV=development npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in a safe environment
5. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add input validation for all user inputs
- Consider security implications of changes
- Document any new environment variables
- Update this README for significant changes

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with Express.js and MySQL
- Uses Nunjucks for templating
- Inspired by competitive programming platforms

---

**Remember**: Always prioritize security when dealing with code execution platforms. Test in isolated environments and never run untrusted code on production systems without proper sandboxing.
