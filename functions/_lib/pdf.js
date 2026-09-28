import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {STATUS_LABELS,OBJECTIVE_LABELS,PROBLEM_LABELS,dateFr,display,presenceLines} from './util.js';

function pdfSafe(value){return display(value).normalize('NFC').replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\x7E\xA0-\xFF]/g,'?')}

export async function generateAuditSummaryPdf(audit){
  const doc=await PDFDocument.create();
  const regular=await doc.embedFont(StandardFonts.Helvetica);
  const bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.04,.10,.21),cyan=rgb(.03,.66,.78),ink=rgb(.10,.14,.20),muted=rgb(.38,.44,.52);
  let page,y;
  const newPage=()=>{page=doc.addPage([595.28,841.89]);page.drawRectangle({x:0,y:776,width:595.28,height:65,color:navy});page.drawText('A&B',{x:42,y:807,size:19,font:bold,color:rgb(1,1,1)});page.drawText('TECHNOLOGIES',{x:88,y:807,size:11,font:bold,color:cyan});page.drawText("Récapitulatif de demande d'Audit Express",{x:42,y:786,size:10,font:regular,color:rgb(.88,.93,1)});page.drawText(pdfSafe(audit.reference),{x:452,y:804,size:10,font:bold,color:rgb(1,1,1)});y=748};
  const wrap=(text,font,size,width)=>{const words=pdfSafe(text).split(/\s+/),lines=[];let line='';for(const word of words){const candidate=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)<=width)line=candidate;else{if(line)lines.push(line);line=word}}if(line)lines.push(line);return lines.length?lines:['Non renseigné']};
  const ensure=height=>{if(y-height<48)newPage()};
  const title=value=>{ensure(34);y-=8;page.drawText(pdfSafe(value).toUpperCase(),{x:42,y,size:10,font:bold,color:cyan});y-=18};
  const field=(label,value)=>{const lines=wrap(display(value),regular,10,475);ensure(23+lines.length*13);page.drawText(pdfSafe(label),{x:42,y,size:9,font:bold,color:muted});y-=14;for(const line of lines){page.drawText(line,{x:42,y,size:10,font:regular,color:ink});y-=13}y-=7};
  newPage();
  field('Référence',audit.reference);field('Date de soumission',dateFr(audit.submitted_at));field('Statut',STATUS_LABELS[audit.status]||audit.status);
  title('Coordonnées');field('Prénom et nom',`${audit.first_name} ${audit.last_name}`);field('E-mail',audit.email);field('Téléphone',audit.phone);
  title('Activité');field('Entreprise / organisation',audit.company_name);field('Activité / secteur',audit.activity);field('Ville / zone',audit.city);field('Description',audit.company_description);
  title('Présence numérique');const presence=presenceLines(audit);field('Canaux et liens communiqués',presence.length?presence.join('\n'):'Aucune présence numérique déclarée');
  title('Objectif');field('Objectif principal',OBJECTIVE_LABELS[audit.main_objective]||audit.main_objective);field('Précisions',audit.objective_details);
  title('Problème actuel');field('Problème principal',PROBLEM_LABELS[audit.main_problem]||audit.main_problem);field('Explications',audit.problem_details);
  title('Informations complémentaires');field('Commentaire',audit.additional_information);field('Consentement','Demande confirmée par le prospect avant envoi.');
  return new Uint8Array(await doc.save());
}

export async function generateConfiguratorSummaryPdf(reference,submittedAt,fields){
  const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const navy=rgb(.04,.10,.21),cyan=rgb(.03,.66,.78),ink=rgb(.10,.14,.20),muted=rgb(.38,.44,.52);
  let page,y;
  const newPage=()=>{page=doc.addPage([595.28,841.89]);page.drawRectangle({x:0,y:776,width:595.28,height:65,color:navy});page.drawText('A&B',{x:42,y:807,size:19,font:bold,color:rgb(1,1,1)});page.drawText('TECHNOLOGIES',{x:88,y:807,size:11,font:bold,color:cyan});page.drawText('Project request summary',{x:42,y:786,size:10,font:regular,color:rgb(.88,.93,1)});page.drawText(pdfSafe(reference),{x:452,y:804,size:10,font:bold,color:rgb(1,1,1)});y=748};
  const wrap=(value,font,size,width)=>{const words=pdfSafe(value).split(/\s+/),lines=[];let line='';for(const word of words){const candidate=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(candidate,size)<=width)line=candidate;else{if(line)lines.push(line);line=word}}if(line)lines.push(line);return lines.length?lines:['Not provided']};
  const ensure=height=>{if(y-height<48)newPage()};
  const field=(label,value)=>{const lines=wrap(value,regular,10,475);ensure(25+lines.length*13);page.drawText(pdfSafe(label),{x:42,y,size:9,font:bold,color:muted});y-=14;for(const line of lines){page.drawText(line,{x:42,y,size:10,font:regular,color:ink});y-=13}y-=7};
  newPage();field('Reference',reference);field('Submission date',submittedAt);for(const [label,value] of fields)field(label,value);
  return new Uint8Array(await doc.save());
}
