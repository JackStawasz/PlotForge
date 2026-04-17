# PlotForge
Final project for GenAI class. PlotForge is a plotting interface for streamlining data analysis workflows.


## Local Server Hosting Instructions

### Startup

1. Open a Linux terminal and cd into the project folder
2. Run the start.sh command to host the python server
3. Open ```src/index.html```

### Notes

If it's the first startup, python dependencies from ```requirements.txt``` will be installed into a new virtual environment folder ```venv```.

If ```requirements.txt``` is updated (to match ```app.py``` imports) then the new dependencies will be installed upon restarting the server. If there is still a missing import due to a failed installation, delete ```venv/.req_hash``` to try again.

Updating ```app.py``` does not require a server reboot: the server package ```flask``` handles this automatically.
