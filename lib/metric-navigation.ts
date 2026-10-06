export const metricItems = [
  {key:"marketcap",label:"시가총액",name:"시가총액",href:"/marketcaps"},
  {key:"per",label:"PER",name:"주가수익비율",href:"/per"},
  {key:"pbr",label:"PBR",name:"주가순자산비율",href:"/pbr"},
  {key:"eps",label:"EPS",name:"주당순이익",href:"/eps"},
  {key:"bps",label:"BPS",name:"주당순자산가치",href:"/bps"},
  {key:"div",label:"배당수익률",name:"배당수익률",href:"/div"},
  {key:"dps",label:"주당배당금",name:"주당배당금",href:"/dps"},
] as const;
export function isRankingPath(pathname:string) {
  return pathname==="/" || /^\/(?:marketcap|marketcaps|per|pbr|eps|bps|div|dps|company|security)(?:\/|$)/.test(pathname);
}
