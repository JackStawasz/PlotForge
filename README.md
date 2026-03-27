# PlotForge
Final project for GenAI class. PlotForge is a plotting interface for streamlining data analysis workflows.

## Local Server Hosting Instructions

1. Open a Linux terminal and cd into the project folder
2. Run the start.sh command to host the python server

Note: If it's the first startup, python dependencies will be installed into a new virtual environment folder ```venv```

## TODO Features

### Simple Add-ons

- Create new "python to latex" converter js file to read, store, and interpret equations in the variables tab
- Add undo/redo buttons to revert changes. Pressing ctrl+z and ctrl+y have the same effect (properly translate for Mac and windows which controls do this).
- Add fill under curve and between curves
- Add dropdown menu when creating latex command using '\'. The menu will provide a list of 5 possible commands to complete the command's argument. The list updates for every character the user enters, so '\r' would suggest \rightarrow \right \rho etc, but then after the user types the next character to make '\ri' the options would reduce down to \rightarrow and \right.
- Add saved & recommended plot presets that bundle plot settings (such as colors and figsizing) into saved configs.
- Reformat annotation customization menu to be more simplistic
- Make "full screen" cover the title bar as well
- Allow deleting of "Plot 1" such that there are no plots and just an "add new plot" box

### Bugs
- Fix interactive js element behaviors when rescaling browser
- Fix grid lines appearing/disappearing by merely panning. Grid lines should only adjust when zooming in/out.
- Block annotations when in matplotlib mode (they are inherently an interactive feature)
- Block duplicate / delete plot options when in full screen (buggy and not intentional)

### Failed Prompts

These are bugs that still persist despite being asked of the AI generator

- Fix x&y label clipping bug: Expand the css max width of the x & y label typeboxes to be 0.9 times the width (x box) or height (y box) of the plotting region
- Fix bug where clicking the "interactive" button (only available after switching to matplotlib mode) effectively "deselects" the current plot window
- Fix bug where data points that locally go to infinity still attempt to connect lines with adjacent points instead of creating a true discontinuity. Fix by using a mix of numerical sampling, clipping, and smart rendering without breaking functionality.
- Fix bug where there are missing leftmost and rightmost vertical grid lines when they should be in display

### Long-Term Features

- Add calling PlotForge as an API from a script (create plot, edit settings, add curve)
- Add regression / curve fitting
- Add light mode to website
- Add custom figsizes (aka plot aspect ratio like 1x1 for square or 5x3 for wide rectangle)
- Add file importing (csv, pkl, json) which reads data into variables
- Add plotting from data / variables (not just templates)
- Add about page for mission statement, tutorial(s), and author contacting