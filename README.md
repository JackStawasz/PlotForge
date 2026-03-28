# PlotForge
Final project for GenAI class. PlotForge is a plotting interface for streamlining data analysis workflows.

## Local Server Hosting Instructions

1. Open a Linux terminal and cd into the project folder
2. Run the start.sh command to host the python server

Note: If it's the first startup, python dependencies will be installed into a new virtual environment folder ```venv```

## TODO Features

### Simple Add-ons

- Create new "python to latex" converter js file to read, store, and interpret equations in the variables tab
- Add fill under curve and between curves
- Add saved & recommended plot presets that bundle plot settings (such as colors and figsizing) into saved configs.

### Bugs
- Fix interactive js element behaviors when rescaling browser
- Fix grid lines appearing/disappearing by merely panning. Grid lines should only adjust when zooming in/out.
- Fix x-axis being hidden (off screen?) when in full screen mode
- Either make hover-over-line displaying coordinates easier to hover over or remove entirely

### Failed Prompts

These are bugs that still persist despite being asked of the AI generator

- Fix x&y label clipping bug: Expand the css max width of the x & y label typeboxes to be 0.9 times the width (x box) or height (y box) of the plotting region
- Fix bug where clicking the "interactive" button (only available after switching to matplotlib mode) effectively "deselects" the current plot window
- Fix bug where data points that locally go to infinity still attempt to connect lines with adjacent points instead of creating a true discontinuity. Fix by using a mix of numerical sampling, clipping, and smart rendering without breaking functionality.
- Fix bug where there are missing leftmost and rightmost vertical grid lines when they should be in display
--When I type 'pi' as a variable it doesn't turn into the symbol (which is good, the user must type \pi). However, typing 'sin' appears as text as it auto recognizes the sine function (which is inconsistent with requiring \pi). Fix this inconsistency by requiring all commands to include '\'

### Long-Term Features

- Add calling PlotForge as an API from a script (create plot, edit settings, add curve)
- Add regression / curve fitting
- Add light mode to website
- Add custom figsizes (aka plot aspect ratio like 1x1 for square or 5x3 for wide rectangle)
- Add file importing (csv, pkl, json) which reads data into variables
- Add plotting from data / variables (not just templates)
- Add about page for mission statement, tutorial(s), and author contacting
- Add plot tabs, each containing a list of plots
- Add user statistics such as plots created (must have had a curve in it), curves generated, and longest list (only include nonzero aka default values)