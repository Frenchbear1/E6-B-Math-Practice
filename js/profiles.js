/* E6-B Trainer — flight profiles and representative aircraft.
   Numbers are realistic approximations for practice only. Always use the actual AFM/POH. */
(function () {
  E6.profiles = {
    ga: {
      key: 'ga',
      name: 'General Aviation',
      tag: 'Single-engine piston',
      desc: 'Trainers and light travelers. Gallons of 100LL, low-altitude winds, VFR & IFR cross-countries.',
      fuelUnit: 'gal', fuelType: '100LL', wind: [5, 35], leg: [25, 240], climbGs: [65, 95], descentFpm: [400, 700], apprGs: [75, 105], tire: [30, 55],
      aircraft: [
        { id: 'c172', name: 'Cessna 172S Skyhawk', tas: [108, 124], cas: [95, 112], alt: [3000, 10500], ff: [7.5, 9.5], cap: 53, vs: 48, va: 105, vaW: 2550,
          wb: { empty: 1663, emptyArm: 39.4, max: 2550, stations: [['Pilot & front passenger', 37.0, [300, 400]], ['Rear passengers', 73.0, [0, 340]], ['Baggage area A', 95.0, [0, 120]]], fuelArm: 48.0, fwd: 35.0, aft: 47.3 } },
        { id: 'pa28', name: 'Piper PA-28-181 Archer', tas: [115, 128], cas: [100, 118], alt: [3000, 11500], ff: [8.5, 10.5], cap: 48, vs: 50, va: 113, vaW: 2550,
          wb: { empty: 1640, emptyArm: 86.2, max: 2550, stations: [['Pilot & front passenger', 80.5, [300, 400]], ['Rear passengers', 118.1, [0, 340]], ['Baggage', 142.8, [0, 200]]], fuelArm: 95.0, fwd: 82.0, aft: 93.0 } },
        { id: 'c182', name: 'Cessna 182T Skylane', tas: [135, 145], cas: [118, 132], alt: [4000, 12500], ff: [11.5, 14], cap: 87, vs: 54 },
        { id: 'sr22', name: 'Cirrus SR22', tas: [160, 183], cas: [140, 160], alt: [5000, 12500], ff: [13.5, 17.5], cap: 92, vs: 70,
          wb: { empty: 2350, emptyArm: 139.4, max: 3600, stations: [['Pilot & front passenger', 143.5, [300, 420]], ['Rear passengers', 180.0, [0, 340]], ['Baggage', 208.0, [0, 130]]], fuelArm: 154.9, fwd: 137.8, aft: 148.1 } },
        { id: 'be36', name: 'Beechcraft Bonanza G36', tas: [163, 176], cas: [140, 155], alt: [4000, 12500], ff: [13, 16], cap: 74, vs: 59 },
      ],
    },
    air: {
      key: 'air',
      name: 'Commercial / Airline',
      tag: 'Turboprop, bizjet & transport',
      desc: 'Flight levels, Mach, Jet A in pounds, high-altitude winds, Part 121 fuel, ETP/PNR and %MAC.',
      fuelUnit: 'lb', fuelType: 'Jet A', wind: [20, 130], leg: [150, 2400], climbGs: [160, 260], descentFpm: [1500, 3000], apprGs: [125, 160], tire: [120, 220],
      aircraft: [
        { id: 'be35', name: 'Beechcraft King Air 350', tas: [290, 312], alt: [24000, 33000], ff: [650, 820], cap: 3600, leg: [150, 1000] },
        { id: 'cj3', name: 'Cessna Citation CJ3+', tas: [380, 416], alt: [37000, 45000], ff: [850, 1100], cap: 4700, leg: [200, 1500] },
        { id: 'e175', name: 'Embraer E175', mach: [0.74, 0.78], tas: [425, 450], alt: [31000, 37000], ff: [3000, 3600], cap: 20500 },
        { id: 'a320', name: 'Airbus A320', mach: [0.76, 0.79], tas: [440, 460], alt: [33000, 39000], ff: [5000, 5800], cap: 42000 },
        { id: 'b738', name: 'Boeing 737-800', mach: [0.76, 0.79], tas: [440, 462], alt: [33000, 41000], ff: [4800, 5600], cap: 46000 },
        { id: 'b77w', name: 'Boeing 777-300ER', mach: [0.83, 0.84], tas: [480, 492], alt: [31000, 41000], ff: [14000, 17000], cap: 320000, leg: [800, 4000] },
      ],
    },
    mil: {
      key: 'mil',
      name: 'Military',
      tag: 'Trainers, fighters, airlift & rotary',
      desc: 'JP-8 in pounds, low-level nav, TOT control, bingo, combat radius, intercepts and tanker rendezvous.',
      fuelUnit: 'lb', fuelType: 'JP-8', wind: [15, 120], leg: [60, 900], climbGs: [180, 350], descentFpm: [2000, 4000], apprGs: [130, 165], tire: [150, 320],
      aircraft: [
        { id: 't6', name: 'T-6A Texan II', tas: [230, 280], alt: [10000, 25000], ff: [350, 500], cap: 950, low: [210, 250], leg: [50, 350], reserve: [200, 300] },
        { id: 't38', name: 'T-38C Talon', mach: [0.8, 0.9], tas: [460, 520], alt: [25000, 41000], ff: [2000, 2800], cap: 3900, low: [360, 420], leg: [80, 500], reserve: [600, 800] },
        { id: 'f16', name: 'F-16C Viper', mach: [0.8, 0.9], tas: [460, 520], alt: [25000, 40000], ff: [2800, 4500], cap: 7000, low: [420, 540], leg: [80, 600], reserve: [1200, 1600] },
        { id: 'f18', name: 'F/A-18E Super Hornet', mach: [0.78, 0.88], tas: [450, 505], alt: [25000, 40000], ff: [4000, 6000], cap: 14400, low: [420, 540], leg: [80, 600], reserve: [2000, 3000] },
        { id: 'c130', name: 'C-130J Super Hercules', tas: [300, 340], alt: [18000, 28000], ff: [4200, 5200], cap: 45900, low: [210, 250], leg: [150, 1500], reserve: [5000, 7000] },
        { id: 'kc135', name: 'KC-135R Stratotanker', mach: [0.76, 0.8], tas: [450, 470], alt: [25000, 37000], ff: [9000, 12000], cap: 200000, leg: [300, 3000], reserve: [12000, 16000] },
        { id: 'c17', name: 'C-17A Globemaster III', mach: [0.74, 0.77], tas: [420, 450], alt: [28000, 37000], ff: [17000, 21000], cap: 240000, leg: [500, 3500], reserve: [18000, 25000] },
        { id: 'uh60', name: 'UH-60M Black Hawk', tas: [130, 150], alt: [500, 8000], ff: [1100, 1400], cap: 2400, low: [100, 130], leg: [30, 250], reserve: [300, 450] },
      ],
    },
  };

  E6.airports = {
    hot: [
      ['KDEN', 'Denver Intl', 5434], ['KASE', 'Aspen/Pitkin Co.', 7820], ['KLXV', 'Leadville', 9934], ['KCOS', 'Colorado Springs', 6187],
      ['KFLG', 'Flagstaff', 7014], ['KJAC', 'Jackson Hole', 6451], ['KSAF', 'Santa Fe', 6348], ['KEGE', 'Eagle County', 6548],
      ['KPHX', 'Phoenix Sky Harbor', 1135], ['KLAS', 'Las Vegas', 2181], ['KABQ', 'Albuquerque', 5355], ['KSLC', 'Salt Lake City', 4227],
      ['KRNO', 'Reno/Tahoe', 4415], ['KBJC', 'Rocky Mountain Metro', 5673], ['KGJT', 'Grand Junction', 4858], ['KMMH', 'Mammoth Yosemite', 7135],
    ],
    ids: ['KMQY', 'KBNA', 'KDFW', 'KATL', 'KORD', 'KMEM', 'KIAH', 'KMSP', 'KSEA', 'KPDX', 'KBOS', 'KCLT', 'KMCO', 'KSAT', 'KOKC', 'KICT', 'KTUL', 'KAUS', 'KSTL', 'KIND', 'KCMH', 'KPIT', 'KDAY', 'KLIT', 'KSHV', 'KMOB', 'KBHM', 'KCHA', 'KTYS', 'KGSO', 'KRDU', 'KRIC', 'KABE', 'KALB', 'KBUF', 'KGRR', 'KMKE', 'KDSM', 'KOMA', 'KFSD'],
    vors: ['MEM', 'BNA', 'GQO', 'VUZ', 'LIT', 'SQS', 'MSL', 'HLI', 'BWG', 'IIU', 'FAM', 'STL', 'TUL', 'OKC', 'ABQ', 'PHX', 'DEN', 'BOS', 'JFK', 'LAX', 'SLC'],
    fixes: ['DRAKO', 'KNOTS', 'BRAVE', 'HITHR', 'MIKEE', 'SOOIE', 'CHUKK', 'TIGRR', 'BOOTH', 'JIMMY', 'VALLY', 'FLASH', 'RAMBL', 'OKIEE', 'SWAMP'],
  };
})();
