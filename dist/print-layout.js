// Append-only layout: future chunks can never move text that has already struck the paper.
export class PrintLayout {
  constructor(measure,{width=824,rowsPerPage=32}={}){this.measure=measure;this.width=width;this.rowsPerPage=rowsPerPage;this.pages=[['']];this.page=0;this.row=0;this.lastCR=false;}
  get lines(){return this.pages[this.page];}
  newLine(){const previous=this.lines[this.row];this.row++;let pageChanged=false;if(this.row===this.rowsPerPage){this.page++;this.row=0;this.pages.push(['']);pageChanged=true;}else this.lines.push('');return{type:'line',page:this.page,row:this.row,pageChanged,ring:previous.trim().length>0};}
  push(char){
    if(char==='\r'){this.lastCR=true;return[this.newLine()];}
    if(char==='\n'){if(this.lastCR){this.lastCR=false;return[];}return[this.newLine()];}
    this.lastCR=false;
    if(char==='\t')char='    ';
    const events=[];
    if(this.lines[this.row]&&this.measure(this.lines[this.row]+char)>this.width)events.push(this.newLine());
    const x=this.measure(this.lines[this.row]);this.lines[this.row]+=char;
    events.push({type:'character',char,x,page:this.page,row:this.row});return events;
  }
}
