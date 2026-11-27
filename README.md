# E6-B Trainer

Randomized, realistic flight-computer practice for the **E6-B** and **CX-3**: from a Skyhawk cross-country to a Mach 0.84 oceanic ETP to a 480-knot low-level time-over-target.

**Live:** open `index.html` (works straight from disk or on GitHub Pages; no build step).

## Practice
- **Profiles:** General Aviation (single-engine piston, gallons of 100LL), Commercial/Airline (flight levels, Mach, Jet A in lb, Part 121), Military (JP-8, low-level, TOT, bingo, combat radius, intercepts), or Mixed.
- **51 problem types across 11 categories:** time/speed/distance, fuel planning and reserves, wind triangles (with variation and deviation), finding winds, crosswind components, best runway, winds-aloft (FB) decoding, pressure/density/true altitude, TAS, Mach, ISA, cloud bases, climb gradients, top of descent, crossing restrictions, glidepaths, 1-in-60, time to station, holding entries and wind correction, VDP, FAF→MAP timing, standard-rate turns, load factor, turn radius, Va at weight, pivotal altitude, glide, hydroplaning, W&B loading, weight shift, ballast, %MAC, ETP, PNR, radius of action, TOT control, intercept/tanker closure, and unit conversions.
- **Modes:** Practice (endless), Quiz, Exam (no feedback until the end, optional time limit) and Sprint (beat the clock).
- **Customization:** presets (Private, Instrument, Commercial, ATP, Military), pick individual categories, difficulty, answer tolerance, typed / multiple-choice / mixed, fuel units, inHg/hPa, hints, worked solutions, flight-computer technique, diagrams, auto-advance, a scratch calculator, and an adaptive "focus weak areas" option.
- Every answer comes with a step-by-step solution, how to do it on the E6-B / CX-3, and a wind-triangle, runway or holding-sector diagram where it applies.
- Stats are saved locally: accuracy and average time by category, session history, and a missed-question bank you can review.

## Tools (CX-3 style)
Heading & GS, find wind, crosswind, winds-aloft decoder, TAS & density altitude, Mach, true altitude, standard atmosphere, pressure altitude, TSD, fuel, turn performance, climb/descent planner, climb gradient, fuel weight/volume, ETP & PNR, 1-in-60, time to station, holding entry & wind, approach helpers, a weight & balance table with %MAC, weight shift/ballast, rules of thumb, unit converter, and a stopwatch/countdown.

## Files
`js/aviation.js` holds the math (ISA, compressible airspeed, wind triangle, holding sectors per AIM 5-3-8), `js/problems.js` the generators, `js/tools.js` the calculators, `js/app.js` the UI.

> For training only, not for flight planning. Aircraft data are representative approximations; always use the AFM/POH and current FAA guidance.
