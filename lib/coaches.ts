import type {Coach,CoachSpecialty} from './game-engine';

type CoachSeed=[name:string,nation:string,rating:number,preferredFormation:string,specialty:CoachSpecialty];

const seeds:CoachSeed[]=[
 ['Pep Guardiola','ESP',96,'4-3-3','attack'],['Carlo Ancelotti','ITA',95,'4-2-3-1','balance'],['Jürgen Klopp','GER',95,'4-3-3','attack'],['Diego Simeone','ARG',94,'4-4-2','defense'],
 ['Luis Enrique','ESP',94,'4-3-3','attack'],['Xabi Alonso','ESP',93,'3-4-2-1','balance'],['Mikel Arteta','ESP',93,'4-3-3','attack'],['Antonio Conte','ITA',92,'3-4-3','defense'],
 ['Simone Inzaghi','ITA',92,'3-5-2','balance'],['Hansi Flick','GER',92,'4-2-3-1','attack'],['Thomas Tuchel','GER',91,'3-4-2-1','defense'],['Unai Emery','ESP',91,'4-2-3-1','balance'],
 ['Julian Nagelsmann','GER',91,'4-2-3-1','attack'],['José Mourinho','POR',91,'4-2-3-1','defense'],['Zinedine Zidane','FRA',91,'4-3-3','balance'],['Arne Slot','NED',90,'4-2-3-1','attack'],
 ['Roberto De Zerbi','ITA',90,'4-2-3-1','attack'],['Rúben Amorim','POR',90,'3-4-2-1','development'],['Luciano Spalletti','ITA',90,'4-3-3','balance'],['Didier Deschamps','FRA',90,'4-2-3-1','balance'],
 ['Marcelo Bielsa','ARG',89,'4-1-4-1','attack'],['Massimiliano Allegri','ITA',89,'4-3-3','defense'],['Gian Piero Gasperini','ITA',89,'3-4-2-1','attack'],['Vincent Kompany','BEL',88,'4-2-3-1','development'],
 ['Enzo Maresca','ITA',88,'4-3-3','development'],['Ange Postecoglou','AUS',88,'4-3-3','attack'],['Oliver Glasner','AUT',88,'3-4-2-1','balance'],['Thomas Frank','DEN',88,'4-3-3','development'],
 ['Eddie Howe','ENG',88,'4-3-3','development'],['Andoni Iraola','ESP',87,'4-2-3-1','attack'],['Thiago Motta','ITA',87,'4-2-3-1','balance'],['Maurizio Sarri','ITA',87,'4-3-3','attack'],
 ['Nuno Espírito Santo','POR',87,'4-2-3-1','defense'],['Brendan Rodgers','NIR',86,'4-3-3','development'],['Marco Silva','POR',86,'4-2-3-1','balance'],['Roger Schmidt','GER',86,'4-2-3-1','attack'],
 ['Şenol Güneş','TUR',86,'4-2-3-1','attack'],['Fatih Terim','TUR',88,'4-2-3-1','motivation'],['Okan Buruk','TUR',87,'4-2-3-1','balance'],['Abdullah Avcı','TUR',85,'4-2-3-1','defense'],
 ['Vincenzo Montella','ITA',86,'4-2-3-1','attack'],['Arsène Wenger','FRA',92,'4-2-3-1','development'],['Sir Alex Ferguson','SCO',96,'4-4-2','motivation' as CoachSpecialty],['Vicente del Bosque','ESP',93,'4-2-3-1','balance'],
 ['Joachim Löw','GER',90,'4-2-3-1','attack'],['Louis van Gaal','NED',91,'3-4-1-2','development'],['Fabio Capello','ITA',91,'4-4-2','defense'],['Guus Hiddink','NED',89,'4-3-3','balance'],
 ['Rafael Benítez','ESP',89,'4-2-3-1','defense'],['Manuel Pellegrini','CHI',88,'4-2-3-1','attack'],['Claudio Ranieri','ITA',88,'4-4-2','motivation'],['Jorge Jesus','POR',88,'4-2-3-1','attack'],
 ['Jorge Sampaoli','ARG',87,'3-4-2-1','attack'],['Dorival Júnior','BRA',86,'4-2-3-1','balance'],['Tite','BRA',88,'4-2-3-1','defense'],['Fernando Diniz','BRA',86,'4-2-3-1','attack'],
 ['Roberto Mancini','ITA',89,'4-3-3','balance'],['Graham Potter','ENG',86,'3-4-2-1','development'],['Erik ten Hag','NED',87,'4-2-3-1','development'],['Paulo Fonseca','POR',86,'4-2-3-1','attack']
];

const specialties:CoachSpecialty[]=['attack','defense','balance','development','motivation'];
export const COACHES:Coach[]=seeds.map(([name,nation,rating,preferredFormation,specialty],index)=>{
 const resolved=specialties.includes(specialty)?specialty:'balance';
 return{kind:'coach',id:`coach-${index+1}`,name,slot:'COACH',role:'Teknik Direktör',rating,price:Math.max(10,(rating-76)*2),nation,
  tactics:Math.min(99,rating+(index%5)-2),motivation:Math.min(99,rating+((index*3)%7)-3),adaptability:Math.min(99,rating+((index*5)%9)-4),development:Math.min(99,rating+((index*7)%11)-5),preferredFormation,specialty:resolved};
});
