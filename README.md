# Local Online Judge

A local implementation of an Online Judge system for testing and competition hosting. This project allows you to run programming contests and test solutions locally on your machine.

⚠️ **SECURITY WARNING**: Code submitted to this judge will NOT be run in a safe or sandboxed environment. Only use this system in trusted environments and with trusted participants.

## Features

- 🏆 **Local Competition Hosting**: Run programming contests on your local machine
- 🧪 **Solution Testing**: Test and validate programming solutions locally
- 📊 **Real-time Judging**: Immediate feedback on submitted solutions
- 🔄 **Multiple Languages**: Support for various programming languages
- 📈 **Scoreboard**: Track participant performance and rankings

## Quick Start

### Prerequisites

- Python 3.8+ (recommended)
- A modern web browser
- Compiler/interpreter for the programming languages you want to support

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CuteMurasame/local-online-judge.git
cd local-online-judge
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000` (or the specified port)

## Usage

### Setting Up a Contest

1. **Prepare Problem Sets**: Create problem directories with test cases
2. **Configure Languages**: Set up supported programming languages and their execution commands
3. **Start the Server**: Launch the online judge application
4. **Register Participants**: Allow contestants to register or pre-register users

### Submitting Solutions

1. Navigate to the problem list
2. Select a problem to solve
3. Write your solution in the code editor
4. Submit for judging
5. View results and feedback

### Viewing Results

- **Live Scoreboard**: Real-time ranking updates
- **Submission History**: Track all submissions per user
- **Detailed Feedback**: View compilation errors, runtime errors, and test case results

## Project Structure

```
local-online-judge/
├── README.md          # This file
├── app.py            # Main application entry point
├── config/           # Configuration files
├── problems/         # Problem sets and test cases
├── submissions/      # User submissions storage
├── static/          # CSS, JavaScript, and assets
├── templates/       # HTML templates
├── judge/           # Core judging logic
└── utils/           # Utility functions
```

## Configuration

### Language Support

Configure supported programming languages in `config/languages.json`:

```json
{
  "cpp": {
    "compile": "g++ -o {output} {source}",
    "execute": "./{output}",
    "extension": ".cpp"
  },
  "python": {
    "compile": null,
    "execute": "python {source}",
    "extension": ".py"
  }
}
```

### Judge Settings

Modify `config/judge.json` for execution limits:

```json
{
  "time_limit": 2.0,
  "memory_limit": 256,
  "compilation_timeout": 30
}
```

## Problem Format

Problems should follow this directory structure:

```
problems/
└── problem_id/
    ├── problem.json      # Problem metadata
    ├── statement.md      # Problem description
    ├── input/           # Test case inputs
    │   ├── 1.txt
    │   ├── 2.txt
    │   └── ...
    └── output/          # Expected outputs
        ├── 1.txt
        ├── 2.txt
        └── ...
```

### Problem Metadata Example

```json
{
  "title": "Two Sum",
  "difficulty": "Easy",
  "time_limit": 1.0,
  "memory_limit": 128,
  "points": 100
}
```

## Security Considerations

⚠️ **CRITICAL SECURITY NOTICE**

This online judge system does **NOT** provide sandboxing or security isolation. Submitted code will run with the same privileges as the judge process. This means:

- **Malicious code can access the file system**
- **Network access is not restricted**
- **System calls are not limited**
- **Resource consumption is not strictly controlled**

### Recommended Safety Measures

1. **Use in isolated environments** (Virtual machines, containers)
2. **Run with limited user privileges**
3. **Monitor system resources**
4. **Only allow trusted participants**
5. **Regular backups of important data**
6. **Consider using Docker for additional isolation**

## API Documentation

### REST Endpoints

- `GET /api/problems` - List all problems
- `POST /api/submit` - Submit a solution
- `GET /api/submission/{id}` - Get submission details
- `GET /api/scoreboard` - Get current rankings

### WebSocket Events

- `submission_update` - Real-time submission status updates
- `scoreboard_update` - Live scoreboard changes

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port in the configuration
2. **Compilation errors**: Verify compiler installation and paths
3. **Permission denied**: Check file permissions for submissions directory
4. **Slow judging**: Consider adjusting time limits or system resources

### Debug Mode

Run with debug mode for detailed logging:

```bash
python app.py --debug
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by popular online judge platforms
- Built for educational and local competition purposes
- Community contributions and feedback

## Support

For issues, questions, or contributions:

- Open an issue on GitHub
- Check existing documentation
- Review the troubleshooting section

---

**Remember**: This system is designed for local use and educational purposes. Always prioritize security when deploying in any environment.
