// =====================================================================
// STORY CONFIG — edit text, camera views, filters and charts here.
// =====================================================================
//
// Chapter options:
//   location: { center, zoom, pitch, bearing } camera view
//   color:    dot color beside the title (default: the program's color)
//   image / imageAlt / imageCaption: photo above the text
//   compareImages: { before, after, alt } before/after photos with a slider
//                  (use instead of image; imageCaption still works)
//   focus:    an address to circle on the map
//   districts: true to shade community districts by total new units
//   zoning:   true to shade low-density R1–R3 zoning districts (MapPLUTO)
//   dots:     false to hide the building dots on this slide
//   wide:     true for a wider text box (like the overview)
//   more:     { label, page } a button that opens an HTML page (e.g. in
//             ./pages/) in an overlay over the map
//
// filter (which points the map shows; all optional):
//   programs: ['421a', '485-X', '420c', 'Article XI', 'No Tax Incentive', 'Other']
//             (leave out to show every program)
//   minUnits / maxUnits: net new units (classanet) per building
//   minYear / maxYear:   permit year
//
// chart (small chart, bottom right):
//   groupBy:   any property name, e.g. 'boro_name', 'zone_group', 'permityear',
//              'size_group', 'prog'
//   metric:    'units' (sum), 'perbuilding' (median units per building)
//              or 'lotarea' (median lot area)
//              (the Units / Per Building buttons only show for the first two)
//   title
//   filter:    chart different buildings than the map (same keys as filter)
//   top:       show only the N biggest bars, e.g. top: 5
//   highlight: group(s) drawn in color with their numbers, the rest muted:
//              'No Tax Incentive' or a list, ['421a', '485-X']
//
// featureChart (larger bottom-right chart instead of the small one,
// one bar per program):
//   title, note, programs, metric: 'units' or 'average'
//
// "Other" = UDAAP, Article IV, 420a, Other Senior Housing

var config = {
  accessToken: 'pk.eyJ1IjoieW9zaGlvajIiLCJhIjoiY212ems3enNwMDA2ZTJ6cHNlZjB2dWJtMyJ9.jWqxWy4zIygoA2tRhcnSkg',
  // Basemap. A Studio style works too, as long as it doesn't also contain
  // the points layer (or you'll see them twice).
  style: 'mapbox://styles/mapbox/dark-v11',
  dataUrl: './data/nc_prod.geojson',
  // Subway lines and stations under the points. Set to '' to hide them.
  subwayRoutesUrl: './data/nyc-subway-routes.geojson',
  subwayStopsUrl: './data/nyc-subway-stops.geojson',
  // Community districts shaded by total new units. Readers can switch it on
  // under "Map layers" in the explorer; add districts: true to a chapter to
  // show it on that slide. Set to '' to remove it.
  districtsUrl: './data/NYC_Community_Districts_-8632813462877227078.geojson',
  // Low-density (R1–R3) zoning, built from MapPLUTO 26v3.
  // Shown on slides with zoning: true;
  // readers can also switch it on under "Map layers" in the explorer.
  // Set to '' to remove it.
  zoningUrl: './data/low-density-zoning.geojson',

  // Branding. headerLogo is the white logo that shrinks into the header as
  // you scroll; logo is the full-colour one in the footer. Set either to ''
  // to hide it.
  headerLogo: './assets/chpc-logo-white.png',
  logo: './assets/chpc-logo.png',
  logoAlt: 'CHPC — Citizens Housing & Planning Council, New York City',
  logoLink: 'https://chpcny.org',

  title: 'Land and Demand: Where Is Housing Built in NYC?',
  subtitle: 'The price of land and market demand determine what tax incentives and subsidies are required to build new housing in different neighborhoods.',
  byline: 'By Yoshi Omi-Jarrett',
  footer: 'Source: DCP Housing Database, HPD Affordable Housing Production, DCP PLUTO, DCP MapPLUTO 26v3, HPD 485-x Registrations, DOF Property Exemption Detail, HPD 421-a Registrations.',

  chapters: [
    {
      id: 'overview',
      title: 'Location, Location, Location',
      description: 'New Yorkers generally understand that location signficantly impacts how much it costs to rent or buy a home. Neighborhoods with better transit-access, parks, and schools are more appealing and therefore have more <i> demand</i>. In turn, this boosts the <i>value of land</i>, shaping how much it costs to aquire land for affordable housing. <br> <br> <b>This report aims to show how the city uses various tax incentives to build affordable housing across the city given the limited availability of city-owned land and subsidy for affordable housing, as well as the high cost of land and disproportionatley high taxes leved against rental properties.</b> <br><br> Each point represents a residential building built since 2014, shaded by the tax incentive it used and sized by the number of units it added. <br><br>  <b>Scroll down</b> to learn more!',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: {},
      chart: { groupBy: 'boro_name', metric: 'units', title: 'New Units by Borough' }
    },
    {
      id: 'small-homes',
      title: 'One and Two-Family Homes',
      description: 'Over half of new <i>buildings</i> (about 7,100) are one or two-family homes, but they add make less than 4% of all new <i> units</i> (10,700). Nearly all of these were built without a tax incentive, and they are concentrated in the suburban neighborhoods of eastern Queens and Staten Island. <br> <br> Many of these projects are simply redevelopments of existing single family houses, and the construction of these homes is not enough to keep up with the city\'s demand for housing.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { minUnits: 1, maxUnits: 2 },
      chart: { groupBy: 'zone_group', metric: 'units', title: 'New Units by Zoning District' },
      zoning: true,
      color: '#8ecae6'
    },
    {
      id: 'all-multifamily',
      title: 'Multifamily Housing',
      description: 'Most of the city\'s new housing comes from multifamily development built with tax incentives (about 85%). <br> <br>The City\'s property tax code disproportionatley taxes multfamily rental housing, making these tax incentives necessary to support the construction of new rental buildings. While broad in their applicability, these tax programs are crucial to enabling the city to grow to meet its housing need. <br> <br> Additionally, restrictive zoning in places like Staten Island and Eastern Queens, along with the high cost of land and construction, means that most new multifamily housing is built in only a few neighborhoods where there is both demand and zoned capacity.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { minUnits: 3 },
      chart: { groupBy: 'prog', metric: 'units', title: 'Multifamily Buildings by Affordability Program' }
    },
    {
      id: '100%-affordable',
      title: 'Fully Subsidized Affordable Housing Requires Cheap Land',
      description: 'New York City subsidizes large affordable housing projects through the Article XI and 420-c tax incentive programs. These programs support housing projects that require at least two-thirds, and often 100% of units to be income-restricted and affordable by completely or partially exempting property taxes for up to 60 years. <br> <br> These projects are mostly built in neighborhoods further from Manhattan where land is cheap but can also be built in more expensive areas on city owned land. These are the largest buildings on average, as developers are incentivized to get the most bang for their buck.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { programs: ['420c', 'Article XI'] },
      chart: { groupBy: 'prog', metric: 'units', title: 'Multifamily Buildings by Affordability Program',
        filter: {},
        highlight: ['420c', 'Article XI']
      }
    },
    {
      id: 'newport',
      title: '100% Affordable Housing: 203 Newport Street, Brownsville',
      description: 'This 420-c building in Brownsville, Brooklyn added 174 units of affordable housing above a new light manufacturing space. Built on an existing industrial site, the project benefitted from low land costs as well as a range of generous government subsidies. <br> <br> Funding included a $16 Million state capital grant, $11.4 million in permanent tax-exempt bonds, $46 Million in equity from Federal Low-Income Housing Tax Credits, $16.9 Million in additional state subsidy, $6.5 Million through the Homeless Housing Assistance Program, $17.1 Million from NYC HPD, as well as additional funding for supporting housing services.',
      image: './data/Bridge-2C.jpg.webp',
      imageAlt: 'Courtyard garden between mid-rise apartment buildings at 203 Newport Street',
      imageCaption: '',
      focus: '203 NEWPORT STREET',
      location: { center: [-73.91060, 40.65986], zoom: 14, pitch: 0, bearing: 0 },
      filter: { programs: ['420c', 'Article XI'] },
    },
    {
      id: 'hunts-point',
      title: 'Affordable Housing on City-Owned Land: 1-15 57 Avenue',
      description: 'In certain cases, low-income housing can be developed in areas with higher demand, but only when the cost of land is fully subsidized. <br> <br> Using the Article XI tax exemption, these buildings at Hunters Point in Long Island City were built on government-owned land and acquired for $3, making it possible for 75% of the units to be affordable.',
      image: './data/GOTHAM-SOUTHTOWER-FP-PROJECT-2.png',
      imageAlt: 'The North Tower at Gotham Point in Long Island City.',
      imageCaption: '',
      focus: '1-15 57 AVENUE',
      location: { center: [-73.96030, 40.73973], zoom: 12, pitch: 0, bearing: 0 },
      filter: { programs: ['Article XI'] }
    },
    {
      id: 'mixed-income',
      title: 'Mixed-Income Housing Is Responsible for 60% of New Multifamily Since 2014',
      description: 'Mixed-income buildings make up the majority of the city\'s new multifamily housing. These programs have been used to build over 166,000 units of housing since 2014, more than half of all new production. <br><br> Buildings vary in size but are concentrated in the rapidly growing neighborhoods of waterfront Brooklyn and Queens, Manhattan\'s Hudson Yards, and the Bronx. In these areas, <b>the high cost of land can be offset by tax incentives</b>, allowing mixed-income development to pencil out. <br> <br> The 421-a tax exemption was the main incentive tool for this type of housing but was proceeded by the 485-X tax exemption in 2024. ',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { programs: ['421a', '485-X'] },
      chart: { groupBy: 'prog', metric: 'units', title: 'Multifamily Buildings by Affordability Program',
        filter: { },
        highlight: ['421a', '485-X']
       },
      wide: true,
      more: { label: 'History of 421-a', page: './pages/421a-history.html' }
    },
    {
      id: 'commie-corridor',
      title: '421-a Has Been a Tool for Growth',
      image: './data/wburg 1.jpeg',
      description: 'Rezonings along the Brooklyn waterfront created opportunity for residential development of underutilized industrial land. Unlike the Hunters Point project, these buildings were constructed on expensive private land, necessitating the use of the 421-a tax exemption. In exchange for the tax break, developers set aside at least 25 percent of the units as affordable.<br> <br> You can learn more about the complexities of financing affordable housing HERE (link to Inside the Rent).',
      location: { center: [-73.96283, 40.71664], zoom: 12.5, pitch: 0, bearing: 0 },
      filter: { programs: ['421a'] },
      chart: { groupBy: 'permityear', metric: 'units', title: '421-a Units by Permit Year' }
    },
    {
      id: '485x',
      title: 'The Future of Mixed-Income Housing',
      description: '485-x, 421-a\'s successor, has so far produced about 3,000 units of housing — although 17,000 units have been permitted. <br> <br> 485-x buildings are smaller on average, and are most concentrated in the Bronx. Its affordability and prevailing wage requirements are stricter, especially in the densest and most expensive neighborhoods, so fewer larger projects pencil out. <br> <br> The program is still new, but without legislative changes it is unlikely that 485-x meets the same rate of production as 421-a.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { programs: ['485-X'] },
      // Larger chart, bottom right (replaces the small chart on this slide).
      featureChart: {
        title: 'Units per Building: 421-a vs 485-x',
        note: 'Average net new units per building, all permit years',
        programs: ['421a', '485-X'],
        metric: 'average'
      }
    },
    {
      id: 'no-incentive',
      title: 'Multifamily Buildings without Tax Incentives',
      description: 'The housing market doesn\'t always support the development of mixed-income or fully affordable rental housing. Most of the buildings not covered by tax incentives are too small to benefit or are built in neighborhoods where market rents are high enough to support market-rate development of expensive rentals or condos. <br> <br>  Manhattan is the only borough with a signficant number of these larger non-incentive buildings, which makes sense given the high cost of land, and the strong demand for housing.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { programs: ['No Tax Incentive'], minUnits: 3 },
      chart: { groupBy: 'prog', metric: 'units', title: 'Multifamily Units by Tax Incentive',
        filter: { minUnits: 3 }, highlight: 'No Tax Incentive' }
    },
    {
      id: 'south-2-street',
      title: 'Some Buildings are Too Small to Qualify for Tax Incentives',
      description: 'This 4 unit condo building was built on a vacant lot in Williamsburg, Brooklyn, a neighborhood with high demand and expensive land, but on a street with limited zoned density. <br> <br> Projects like these are only possible due to the unique combination of cheaper, vacant land and a high demand housing market. The land was purchased for $810,000 in 2014 and each of the building\'s four units were sold for more than $1.5 Million in 2024.',
      compareImages: {
        before: './data/232south2before.jpg',
        after: './data/232south2after.jpg',
        alt: 'Before and after construction of 232 South 2 Street, Williamsburg, Brooklyn.'
      },
      imageCaption: 'Drag to see before and after. Images: NYC Department of Finance.',
      focus: '232 SOUTH 2 STREET',
      location: { center: [-73.96655, 40.71202], zoom: 14, pitch: 0, bearing: 0 },
      filter: { programs: ['No Tax Incentive'], minUnits: 3, maxUnits: 5 },
      chart: { groupBy: 'size_group', metric: 'lotarea', title: 'Median Lot Area by Building Size (No Tax Incentive)',
      filter: { programs: ['No Tax Incentive'] }, highlight: '3–5' }
    },
    {
      id: 'large-multifam-no-incentive',
      title: 'Only Select Large Buildings Work without Tax Incentives',
      description: 'Large buildings built without tax incentives make up only 10% of all large multifamily buildings built since 2014. <br> <br> These buildings are concentrated in neighborhoods with high demand for housing, and are mostly marketed as expensive condos and rentals. ', 
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { programs: ['No Tax Incentive'], minUnits: 50 },
      // Each bar: units in 50+ unit buildings of that program, as a % of
      // all new units. The no-incentive bar is drawn in color.
      chart: { groupBy: 'prog', metric: 'units', title: 'Units in 50+ Unit Buildings',
        filter: { minUnits: 50 }, highlight: 'No Tax Incentive' }
    },
    {
      id: 'neighborhoods',
      title: 'Not All Neighborhoods are Producing Their Fair Share',
      description: 'Most of the City\'s housing production is concentrated in a select few neighborhoods, due to the combination of high land prices, limited subsidy, and restrictive zoning. <br> <br> New York City\'s Fair Housing Growth Strategy determined that the city needs to build 700,000 new units of housing over the next 10 years to meet both the current and future need. But since 2014, the city has averaged only ~25,000 permitted units per year, signficantly below the required pace. <br> <br> The City of Yes for Housing Opportunity, passed in 2024, aimed to address zoning that has historically prevented housing and our research shows that development is beginning to take place in many of these medium density outer borough neighborhoods. <br> <br> The city must continue to use its zoning powers to legalize multifamily housing in neighborhoods citywide and push forward an improved tax incentive program to ensure we are building enough affordable housing.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { minUnits: 3 },
      districts : true,
      dots: false,
      chart: { groupBy: 'cdtanamesimple', metric: 'units', title: 'Top 5 Neighborhoods by New Units', top: 5 }
    },
    {
      id: 'summary',
      title: 'Given the City\'s Finite Pool of Subsidy, Lawmakers Must Ensure Tax Incentives Work',
      description: 'Given the high cost of land, and the limited subsidy availiable to build affordable housing, it is imperative that the city and state improves the 485x tax incentive program to make sure we are keeping up with production. As the city develops the limited number of ... something about finite land and no large Wburg-Greenpoint type rezonings.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      filter: { minUnits: 3 , programs: ['485-X'] },
      wide: true,
      chart: { groupBy: 'boro_name', metric: 'units', title: 'Units by Borough' }
    },
    {
      id: 'explore',
      title: 'Explore the data',
      description: 'Use the controls to filter by program and building size, and click any point for details.',
      location: { center: [-73.94, 40.70], zoom: 9.9, pitch: 0, bearing: 0 },
      explore: true,
      filter: {},
      chart: { groupBy: 'boro_name', metric: 'units', title: 'New units' }
    }
  ]
};
