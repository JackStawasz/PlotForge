# PlotForge
Final project for GenAI class. PlotForge is a plotting interface for streamlining data analysis workflows.

## Local Server Hosting Instructions

1. Open a Linux terminal and cd into the project folder
2. Run the start.sh command to host the python server

Note: If it's the first startup, python dependencies will be installed into a new virtual environment folder ```venv```

## TODO Features

### Simple Add-ons

- Create new "python to latex" converter js file
- Add variable storage to left side bar. Move templates to a new "add to plot" popup screen which will later allow plotting from data.
- Add undo/redo buttons to revert changes. Pressing ctrl+z and ctrl+y have the same effect (properly translate for Mac and windows which controls do this).
- Add fill under curve and between curves
- Add full screen button to plot

### Failed Prompts

These are bugs that still persist despite being asked of the AI generator

- Fix x&y label clipping bug: Expand the css max width of the x & y label typeboxes to be 0.9 times the width (x box) or height (y box) of the plotting region
- Fix bug where clicking the "interactive" button (only available after switching to matplotlib mode) effectively "deselects" the current plot window
- Fix bug where data points that locally go to infinity still attempt to connect lines with adjacent points instead of creating a true discontinuity. Fix by using a mix of numerical sampling, clipping, and smart rendering without breaking functionality.
- Fix bug where there are missing leftmost and rightmost vertical grid lines when they should be in display
- Display template options by the order they appear in templates.json instead of alphabetically

### Long-Term Features

- Add calling PlotForge as an API from a script (create plot, edit settings, add curve)
- Add regression / curve fitting