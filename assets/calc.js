(function(){
  var R={
    "uk-lon":{amt:13761,cur:"£",name:"GBP",note:"£1,529 × 9 months"},
    "uk-out":{amt:10539,cur:"£",name:"GBP",note:"£1,171 × 9 months"},
    "uk-lon-new":{amt:14130,cur:"£",name:"GBP",note:"£1,570 × 9 months"},
    "uk-out-new":{amt:10827,cur:"£",name:"GBP",note:"£1,203 × 9 months"},
    "ca":{amt:23448,cur:"CA$",name:"CAD",note:"Living costs only, tuition extra"},
    "de":{amt:13092,cur:"€",name:"EUR",note:"€1,091 × 12 months"},
    "ie":{amt:10000,cur:"€",name:"EUR",note:"Living costs only, tuition extra"},
    "nz":{amt:20000,cur:"NZ$",name:"NZD",note:"Living costs only, tuition extra"}
  };
  var defaults={GBP:2000,CAD:1080,EUR:1720,NZD:870};
  var sel=document.getElementById("route"),rate=document.getElementById("rate"),
      lbl=document.getElementById("rate-label"),outN=document.getElementById("out-naira"),
      outF=document.getElementById("out-foreign"),last=null;
  function fmt(n){return Math.round(n).toLocaleString("en-NG")}
  function calc(){
    var r=R[sel.value];
    if(last!==r.name){rate.value=defaults[r.name];last=r.name}
    lbl.textContent="Naira per "+r.cur+"1";
    var x=parseFloat(rate.value);
    if(!(x>0)){outN.textContent="Enter a rate";outF.textContent="";return}
    outN.textContent="₦"+fmt(r.amt*x);
    outF.textContent=r.cur+fmt(r.amt)+" · "+r.note;
  }
  sel.addEventListener("change",calc);rate.addEventListener("input",calc);calc();
})();
