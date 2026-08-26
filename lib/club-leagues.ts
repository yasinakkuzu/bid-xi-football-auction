export type CustomPoolSelection={type:'club'|'league';name:string;league?:string};

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
export function customPoolOptions(clubs:string[],query:string):CustomPoolSelection[]{
  const q=fold(query.trim());if(q.length<2)return[];
  const clubMatches=[...new Set(clubs)].filter(club=>fold(club).includes(q)).map(name=>({type:'club' as const,name,league:leagueForClub(name)}));
  const related=[...new Set(clubMatches.map(item=>item.league).filter(Boolean) as string[])];
  const leagueMatches=Object.keys(LEAGUE_CLUBS).filter(name=>fold(name).includes(q)||related.includes(name)).map(name=>({type:'league' as const,name}));
  return[...clubMatches,...leagueMatches].slice(0,12);
}
export function matchesCustomPool(club:string,selections:CustomPoolSelection[]){return selections.some(item=>item.type==='club'?item.name===club:LEAGUE_CLUBS[item.name]?.includes(club))}
