export type CustomPoolSelection={type:'club'|'league';name:string;league?:string;code?:string};

type ClubPoolSource=string|{club:string;league?:string};

const LEAGUE_NAMES:Record<string,string>={
  TR1:'Türkiye Ligi',GB1:'İngiltere Premier Ligi',ES1:'İspanya LaLiga',IT1:'İtalya Serie A',L1:'Almanya Bundesliga',FR1:'Fransa Ligue 1',PO1:'Portekiz Ligi',NL1:'Hollanda Eredivisie',
  MLS1:'ABD MLS',BRA1:'Brezilya Série A',ARG1:'Arjantin Primera División',SA1:'Suudi Arabistan Pro Ligi',JAP1:'Japonya J1 Ligi',MEX1:'Meksika Liga MX',TS1:'Türkiye 1. Lig',PL1:'Polonya Ekstraklasa',RO1:'Romanya SuperLiga',SER1:'Sırbistan SuperLiga'
};

const LEAGUE_CLUBS:Record<string,string[]>={
  'Türkiye Ligi':['Fenerbahce','Galatasaray','Besiktas JK','Trabzonspor','Basaksehir FK','Samsunspor','Göztepe','Konyaspor','Alanyaspor','Antalyaspor','Kasimpasa','Caykur Rizespor','Gaziantep FK','Kayserispor','Eyüpspor','Genclerbirligi','Fatih Karagümrük'],
  'İngiltere Premier Ligi':['Arsenal FC','Aston Villa','AFC Bournemouth','Brentford FC','Brighton & Hove Albion','Burnley FC','Chelsea FC','Crystal Palace','Everton FC','Fulham FC','Leeds United','Liverpool FC','Manchester City','Manchester United','Newcastle United','Nottingham Forest','Sunderland AFC','Tottenham Hotspur','West Ham United','Wolverhampton Wanderers'],
  'İspanya LaLiga':['Athletic Bilbao','Atlético de Madrid','FC Barcelona','Real Madrid','Real Betis Balompié','Real Sociedad','Sevilla FC','Valencia CF','Villarreal CF','Girona FC','Rayo Vallecano','RC Celta de Vigo','RCD Espanyol','CA Osasuna','Deportivo Alavés','Getafe CF','Levante UD','Elche CF'],
  'İtalya Serie A':['AC Milan','Inter Milan','Juventus FC','SSC Napoli','Atalanta BC','Associazione Sportiva Roma','SS Lazio','ACF Fiorentina','Bologna Football Club 1909','Torino FC','Udinese Calcio','Genoa CFC','Cagliari Calcio','Parma Calcio 1913','US Sassuolo'],
  'Almanya Bundesliga':['Bayern Munich','Borussia Dortmund','Bayer 04 Leverkusen','RB Leipzig','Eintracht Frankfurt','VfB Stuttgart','SC Freiburg','TSG 1899 Hoffenheim','SV Werder Bremen','VfL Wolfsburg','Borussia Mönchengladbach','1.FSV Mainz 05','FC Augsburg'],
  'Fransa Ligue 1':['Paris Saint-Germain','Olympique Marseille','AS Monaco','Olympique Lyon','LOSC Lille','RC Lens','RC Strasbourg Alsace','Stade Rennais FC','OGC Nice','FC Toulouse'],
  'Portekiz Ligi':['SL Benfica','Sporting CP','FC Porto','SC Braga'],
  'Hollanda Eredivisie':['Ajax Amsterdam','PSV Eindhoven','Feyenoord Rotterdam','AZ Alkmaar']
};

const fold=(value:string)=>value.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export const leagueForClub=(club:string)=>Object.entries(LEAGUE_CLUBS).find(([,clubs])=>clubs.includes(club))?.[0];
export function customPoolOptions(sources:ClubPoolSource[],query:string):CustomPoolSelection[]{
  const q=fold(query.trim());if(q.length<2)return[];
  const sourceRows=[...new Map(sources.map(source=>{const row=typeof source==='string'?{club:source}:{club:source.club,league:source.league};return[`${row.club}:${row.league||''}`,row]})).values()];
  const clubMatches=sourceRows.filter(row=>fold(row.club).includes(q)).map(row=>({type:'club' as const,name:row.club,league:LEAGUE_NAMES[row.league||'']||leagueForClub(row.club),code:row.league||undefined}));
  const relatedCodes=[...new Set(clubMatches.map(item=>item.code).filter(Boolean) as string[])];
  const relatedNames=[...new Set(clubMatches.map(item=>item.league).filter(Boolean) as string[])];
  const availableLeagues=[...new Set(sourceRows.map(row=>row.league).filter(Boolean) as string[])];
  const dynamic:CustomPoolSelection[]=availableLeagues.map(code=>({type:'league',name:LEAGUE_NAMES[code]||`Lig ${code}`,code}));
  const fallback:CustomPoolSelection[]=Object.keys(LEAGUE_CLUBS).map(name=>({type:'league',name}));
  const leagueMatches=[...new Map([...dynamic,...fallback].filter(item=>fold(item.name).includes(q)||relatedNames.includes(item.name)||(item.code&&relatedCodes.includes(item.code))).map(item=>[`${item.code||''}:${item.name}`,item])).values()];
  return[...clubMatches,...leagueMatches].slice(0,12);
}
export function matchesCustomPool(club:string,selections:CustomPoolSelection[],leagueCode?:string){return selections.some(item=>item.type==='club'?item.name===club:Boolean((item.code&&leagueCode===item.code)||LEAGUE_CLUBS[item.name]?.includes(club)))}
