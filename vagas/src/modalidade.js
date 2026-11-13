// Evidência de modalidade: dado ausente permanece ausente; false não significa presencial.
import { normalizarTexto } from './util.js';
const ORDEM = ['presencial', 'hibrido', 'remoto'];
export function modelosNoTexto(valor) {
 const s=normalizarTexto(valor).replace(/_/g,' '); const result=[];
 if(/\b(presencial|on[ -]?site|no escritorio)\b/.test(s))result.push('presencial');
 if(/\b(hibrid[oa]?|hybrid)\b/.test(s))result.push('hibrido');
 if(/\b(remot[oea]?|home[ -]?office|telecommute|anywhere)\b/.test(s))result.push('remoto');
 return result;
}
export function evidenciaModalidade(vaga, { campos=[], localizacao, origem=vaga.fonte||'fonte', padraoRemoto=false }={}) {
 const evidence=[...(vaga.modalidadeEvidencias||[])];
 const add=(campo,valor)=>{if(typeof valor!=='string')return;for(const modelo of modelosNoTexto(valor))evidence.push({modelo,origem,campo,valor});};
 if(!evidence.length){add('modelo',vaga.modelo);if(vaga.remoto===true)add('remoto','remote');}
 for(const c of campos)add(c.campo,c.valor);
 add('titulo',vaga.titulo);add('localizacao',localizacao??vaga.localizacao??vaga.local??vaga.localizacaoBruta);
 const desc=String(vaga.descricao||'').slice(0,400);
 for(const m of desc.matchAll(/(?:modalidade|modelo de trabalho|regime de trabalho|work model|workplace(?: type)?|work arrangement|location|localiza[çc][ãa]o)\s*[:=-]\s*([^\n.!?]{1,120})/gi))add('descricao',m[1]);
 if(padraoRemoto&&!evidence.length)add('acervo','remote');
 const unique=itens=>[...new Map(itens.map(e=>[JSON.stringify(e),e])).values()].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 const ev=unique(evidence);const modelos=ORDEM.filter(m=>ev.some(e=>e.modelo===m));
 const locations=unique([...(vaga.localizacaoEvidencias||[]),...(typeof localizacao==='string'&&localizacao.trim()?[{origem,valor:localizacao}]:[])]);
 const cidades=unique([...(vaga.cidadeEvidencias||[]),...(typeof vaga.cidade==='string'&&vaga.cidade.trim()?[{origem,valor:vaga.cidade}]:[])]);
 return {...vaga,cidadeEvidencias:cidades, modelo:modelos[0]??null, remoto:modelos.length?modelos.length===1&&modelos[0]==='remoto'?true:false:null, modalidadeEvidencias:ev,conflitoModalidade:modelos.length>1,localizacaoBruta:localizacao??vaga.localizacaoBruta??null,localizacaoEvidencias:locations};
}
export function modelosDaVaga(vaga){return [...new Set([...(vaga.modalidadeEvidencias||[]).map(e=>e.modelo),...modelosNoTexto(vaga.modelo),...(vaga.remoto===true?['remoto']:[])])].filter(m=>ORDEM.includes(m));}
export function fundirModalidade(a,b){
 const x=evidenciaModalidade(a,{localizacao:a.localizacaoBruta??a.cidade??a.localizacao??a.local}); const y=evidenciaModalidade(b,{localizacao:b.localizacaoBruta??b.cidade??b.localizacao??b.local});
 const merged=evidenciaModalidade({...a,modalidadeEvidencias:[...x.modalidadeEvidencias,...y.modalidadeEvidencias],localizacaoEvidencias:[...x.localizacaoEvidencias,...y.localizacaoEvidencias],cidadeEvidencias:[...x.cidadeEvidencias,...y.cidadeEvidencias]});
 const cities=[a.cidade,b.cidade].filter(v=>typeof v==='string'&&v.trim()).sort();if(cities.length)merged.cidade=cities[0];
 const raws=merged.localizacaoEvidencias.map(e=>e.valor).sort();merged.localizacaoBruta=raws[0]??null;merged.conflitoLocalizacaoBruta=new Set(raws).size>1;merged.conflitoLocalizacao=new Set(merged.cidadeEvidencias.map(e=>normalizarTexto(e.valor))).size>1;
 return merged;
}
