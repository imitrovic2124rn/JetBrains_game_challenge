export const COMBAT_EXTENSIONS = {
  heavy: { windup: .45, active: .15, recovery: .60, damageMultiplier: 2, movementMultiplier: .75,
    impactFraction: .85, splashRadius: 26, splashDamage: .5, stagger: .45, staggerImmunity: 2,
    shieldReductionIgnored: .30, liftGrip: [1,-9.1,24], strikeGrip: [0,-6,20], raisedPitch: -1.28, tipHeight: 2 },
  mods: { dropChance: .03, options: {
    starting: [
      { id:'weighted', name:'Weighted Head', benefit:'+25% heavy damage', drawback:'+15% heavy recovery', heavyDamage:1.25, heavyRecovery:1.15 },
      { id:'balanced', name:'Balanced Grip', benefit:'20% shorter recovery on both strikes', drawback:'No damage bonus', recovery:.8 },
    ],
    repeater: [
      { id:'precision', name:'Precision Assembly', benefit:'35% tighter spread', drawback:'Normal firing rate', spread:.65 },
      { id:'cycle', name:'High-Cycle Receiver', benefit:'+20% firing rate', drawback:'+15% spread', fireRate:1.2, spread:1.15 },
    ],
    scatter: [
      { id:'choke', name:'Choke', benefit:'30% tighter pellet spread', drawback:'Normal volley damage', spread:.7 },
      { id:'crowd', name:'Crowd Barrel', benefit:'+15% total volley damage', drawback:'+30% pellet spread', spread:1.3, damage:1.15 },
    ],
    launcher: [
      { id:'fragmentation', name:'Fragmentation Payload', benefit:'+20% enemy blast radius', drawback:'10% less enemy damage', blast:1.2, damage:.9 },
      { id:'impact', name:'High-Impact Payload', benefit:'+25% enemy damage', drawback:'20% smaller enemy blast radius', blast:.8, damage:1.25 },
    ],
  } },
  environment: {
    outline:{color:0xffc35e,pixels:3,haloPixels:[4.5,6],haloOpacity:[.12,.045],
      pulsePeriod:3.6,pulseDepth:.10,aimWidth:1.16,aimBrightness:1.10},
    placement: {
      maximumObjects:64, maximumPerSubarea:5, attemptsPerObject:18,
      // Expected objects per 100,000 units of clear, off-road ground around authored scenery.
      areaUnit:100000, areaRadius:380, areaSamples:9, arenaClearance:145,
      sceneryClearance:48, anchorGap:[52,84], maximumAnchorGap:145, electricalAnchorGap:100,
      routeMargin:10, routeCandidates:8, maximumRouteDistance:420,
      independentSeparation:125, groupSpacing:[48,64], groupClearance:22,
      pairChance:.18, tripleChance:.025, groupContexts:['industry','processing','storage'],
      anchorContexts: {
        house:['settlement','workshop','settlement','ruin','industry','storage'],
        wreck:'salvage', highway:'salvage', relay:'utility', furnace:'industry', kiln:'industry',
        tank:'processing', reservoir:'processing', pumphouse:'drainage', flooded:'settlement',
      },
      contextWeights: {
        settlement:{fuel:.45,electric:.5,chemical:.08}, ruin:{fuel:.55,electric:.25,chemical:.15},
        workshop:{fuel:1.3,electric:1,chemical:.45}, storage:{fuel:1,electric:.4,chemical:1},
        salvage:{fuel:1.5,electric:0,chemical:.15}, industry:{fuel:1.1,electric:1.25,chemical:1},
        utility:{fuel:.35,electric:1.6,chemical:.65}, processing:{fuel:.35,electric:.9,chemical:1.8},
        drainage:{fuel:.1,electric:.7,chemical:2},
      },
      biomes: {
        dust:{density:.62,weights:{fuel:.76,electric:.21,chemical:.03}},
        cinder:{density:.78,weights:{fuel:.54,electric:.39,chemical:.07}},
        toxic:{density:.70,weights:{fuel:.12,electric:.20,chemical:.68}},
        marsh:{density:.22,weights:{fuel:.45,electric:.30,chemical:.25},
          electricalContexts:['workshop','industry','utility','processing','drainage']},
      },
      appearance:{variants:3,scale:[.94,1.07],height:[.90,1.12],rotationJitter:.32},
    },
    startClearance:400, interactionClearance:160, supplyClearance:90, plantClearance:230,
    missionClearance:{tower:260,generator:180,toxic:180,convoy:330},
    warningTime:.45, chainDelay:.24, maximumChainDepth:4, detonationsPerUpdate:2,
    revealRadius:170, healthBarTime:2,
    fuel:{name:'Fuel barrel',health:90,radius:7,blastRadius:62,enemyDamage:140,playerDamage:40,damageType:'fire'},
    electric:{name:'Power box',health:75,radius:8,blastRadius:44,playerStun:.75,playerImmunity:3},
    chemical:{name:'Chemical tank',health:120,radius:11,blastRadius:43,duration:7,damage:7,delay:.55},
  },
  onboarding: { pollInterval:.25, readTime:2.5, exposureTime:1, enemyRange:170,
    hints:{
      batLight:{title:'Keep them back',text:'Left-click to swing Relay Breaker.'},
      batHeavy:{title:'Make it count',text:'Right-click for a heavy overhead strike. Give Relay Breaker time to recover.'},
      environment:{title:'Turn the ground against them',text:'Shoot objects with amber outlines. Keep clear of blasts and spills.'},
      mods:{title:'Make it yours',text:'Choose one mod for this weapon. A new mod replaces the old one.'},
      hunter:{title:'Watch for an opening',text:'Press 2 for Hunter. Strike amber openings for extra damage.'},
      filter:{title:'Keep the poison out',text:'Press 1 to filter toxic air. Filter cartridges restore charge.'},
    },
  },
};
