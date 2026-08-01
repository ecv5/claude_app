import { useState, useEffect } from "react";

const PORTFOLIO_CASH = 170000;
type Ticker = string;
const DEFAULT_TICKERS: Ticker[] = ["NET", "AVGO", "LRCX", "AMAT"];
const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

interface Metric {
  label: string;
  value: string;
  target: string;
  status: "good" | "watch" | "risk";
}

interface StrategyItem {
  action: string;
  level: string;
  note: string;
  rationale: string;
  color: string;
}

interface StockInfo {
  name: string;
  ticker: string;
  price: string;
  analystTarget: number;
  high52: number;
  low52: number;
  marketCap: string;
  peRatio: string;
  dividend: string;
  earningsDate: string;
  entryRange: [number, number];
  entryLabel: string;
  firstTrim: number;
  secondTrim: number;
  stopLossVal: number;
  targetAlloc: number;
  thesis: string;
  risks: string[];
  metrics: Metric[];
  watchlist: string[];
  strategy: StrategyItem[];
}

interface Transaction {
  id: number;
  date: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  note: string;
}

interface Position {
  sharesHeld: number;
  avgEntry: number;
  costBasis: number;
  realisedPnL: number;
}

const STATIC_FALLBACK: Record<Ticker, StockInfo> = {
  NET:  { name:"Cloudflare",       ticker:"NET",  price:"197", analystTarget:235, high52:260, low52:143,  marketCap:"~$69B",   peRatio:"N/A",  dividend:"None",       earningsDate:"July 30, 2026",  entryRange:[185,200], entryLabel:"$185–$200", firstTrim:235, secondTrim:260, stopLossVal:160, targetAlloc:42500, thesis:"Edge AI inference layer — Cloudflare's global network as the delivery mechanism for AI at the edge.", risks:["Not yet GAAP profitable","Competition from AWS, Google, Microsoft","Execution risk from 20% workforce reduction"], metrics:[{label:"Revenue (Q1 2026)",value:"$639.8M",target:">$665M",status:"good"},{label:"Revenue Growth",value:"33.5% YoY",target:">25%",status:"good"},{label:"Net Loss",value:"-$22.93M",target:"Improving",status:"watch"}], watchlist:["Revenue vs estimates","Margin improvement post-layoffs","AI revenue traction","NRR >120%"], strategy:[{action:"Buy",level:"$185–$200",note:"Initial position",rationale:"Below 200-day MA, near support",color:"bg-green-600"},{action:"Trim 25%",level:"$230–$240",note:"Near consensus target",rationale:"Analyst consensus zone",color:"bg-yellow-600"},{action:"Trim 25%",level:"$260–$270",note:"Bull case target",rationale:"52w high resistance",color:"bg-orange-600"},{action:"Stop Loss",level:"Below $160",note:"Exit position",rationale:"Major support breakdown",color:"bg-red-600"}] },
  AVGO: { name:"Broadcom",         ticker:"AVGO", price:"420", analystTarget:475, high52:442, low52:222,  marketCap:"~$1.9T", peRatio:"~78x", dividend:"$2.60/yr",   earningsDate:"June 3, 2026",   entryRange:[370,400], entryLabel:"$370–$400", firstTrim:478, secondTrim:520, stopLossVal:320, targetAlloc:42500, thesis:"AI picks-and-shovels — custom AI chips and networking for hyperscalers, VMware software floor.", risks:["Stretched valuation after 139% run","AI revenue deceleration risk","Competition from AMD, Marvell"], metrics:[{label:"Revenue (Q1 FY2026)",value:"$19.3B",target:"~$22B",status:"good"},{label:"AI Revenue",value:"$8.4B (+106%)",target:"$10.7B",status:"good"},{label:"EBITDA Margin",value:"68%",target:">65%",status:"good"}], watchlist:["AI revenue vs $10.7B guidance","EBITDA margin stability","VMware software growth","FCF generation"], strategy:[{action:"Buy",level:"$370–$400",note:"Initial position",rationale:"Key support zone, near 200-day MA",color:"bg-green-600"},{action:"Trim 25%",level:"$463–$478",note:"Near consensus",rationale:"Analyst consensus cluster",color:"bg-yellow-600"},{action:"Trim 25%",level:"$500–$520",note:"Bull targets",rationale:"UBS/TD Cowen price targets",color:"bg-orange-600"},{action:"Stop Loss",level:"Below $320",note:"Exit position",rationale:"Break of major support",color:"bg-red-600"}] },
  LRCX: { name:"Lam Research",     ticker:"LRCX", price:"295", analystTarget:310, high52:302, low52:131,  marketCap:"~$356B", peRatio:"~28x", dividend:"$0.26/qtr", earningsDate:"July 29, 2026",  entryRange:[255,280], entryLabel:"$255–$280", firstTrim:330, secondTrim:385, stopLossVal:230, targetAlloc:42500, thesis:"Semiconductor equipment leader — #1 etch, #2 deposition. AI chip fab capex beneficiary.", risks:["China export restrictions","Semiconductor capex cyclicality","Competition from Applied Materials"], metrics:[{label:"EPS (Apr 2026)",value:"$1.47 vs $1.36",target:"Beat estimates",status:"good"},{label:"Revenue Growth",value:"+23.7% YoY",target:">20%",status:"good"},{label:"June Q Guide",value:"10% above consensus",target:"Confirm Jul 29",status:"good"}], watchlist:["Revenue vs June Q guidance","Memory spending outlook","China revenue exposure","WFE market share"], strategy:[{action:"Buy",level:"$255–$280",note:"Initial position",rationale:"Near 200-day MA support",color:"bg-green-600"},{action:"Trim 25%",level:"$310–$330",note:"Consensus target",rationale:"Analyst consensus zone",color:"bg-yellow-600"},{action:"Trim 25%",level:"$350–$385",note:"Bull targets",rationale:"B. Riley / Goldman targets",color:"bg-orange-600"},{action:"Stop Loss",level:"Below $230",note:"Exit position",rationale:"Key support breakdown",color:"bg-red-600"}] },
  AMAT: { name:"Applied Materials", ticker:"AMAT", price:"435", analystTarget:520, high52:448, low52:153,  marketCap:"~$346B", peRatio:"~41x", dividend:"~$1.68/yr", earningsDate:"Aug 13, 2026",   entryRange:[400,430], entryLabel:"$400–$430", firstTrim:500, secondTrim:550, stopLossVal:360, targetAlloc:42500, thesis:"Largest semiconductor equipment maker. AI capex supercycle driving multi-year growth.", risks:["China export restrictions","WFE spending cyclicality","Competition from ASML, Lam, KLA"], metrics:[{label:"Revenue (Q2 FY2026)",value:"$7.91B (+11.4%)",target:"~$8.95B Q3",status:"good"},{label:"GAAP EPS",value:"$3.51 vs $2.71",target:"Beat estimates",status:"good"},{label:"Semi Equip Growth",value:">30% guided CY2026",target:"Confirm Aug 13",status:"good"}], watchlist:["Revenue vs $8.95B guidance","Semi equipment growth","AI foundry demand","China exposure"], strategy:[{action:"Buy",level:"$400–$430",note:"Initial position",rationale:"Near current price, entry zone",color:"bg-green-600"},{action:"Trim 25%",level:"$475–$500",note:"Consensus target",rationale:"Analyst consensus cluster",color:"bg-yellow-600"},{action:"Trim 25%",level:"$520–$550",note:"Bull targets",rationale:"Deutsche Bank / Bernstein targets",color:"bg-orange-600"},{action:"Stop Loss",level:"Below $360",note:"Exit position",rationale:"Major support breakdown",color:"bg-red-600"}] },
};

// Blank template for a newly-added counter. Analyst fields fill in when the
// user hits Refresh (which calls /api/stock/:ticker); price fills in from the
// Finnhub-backed /api/prices call.
const makeDefaultStock = (ticker: Ticker): StockInfo => ({
  name: ticker, ticker, price: "0",
  analystTarget: 0, high52: 0, low52: 0, marketCap: "—", peRatio: "—",
  dividend: "—", earningsDate: "—", entryRange: [0, 0], entryLabel: "—",
  firstTrim: 0, secondTrim: 0, stopLossVal: 0, targetAlloc: 42500,
  thesis: "No thesis yet — hit Refresh to pull analyst data.",
  risks: [], metrics: [], watchlist: [], strategy: [],
});

const DEFAULT_TX: Record<Ticker, Transaction[]> = {
  NET: [{ id: 1, date: "2026-05-01", type: "buy", shares: 200, price: 191.25, note: "Initial position" }],
  AVGO: [], LRCX: [], AMAT: [],
};

const STORAGE_KEY = "stock-tracker-state-v1";
interface PersistedState {
  tickers: Ticker[];
  stockData: Record<Ticker, StockInfo>;
  transactions: Record<Ticker, Transaction[]>;
  notes: Record<Ticker, string>;
}
const loadPersisted = (): PersistedState | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
};

const earningsSchedule = [
  {ticker:"AVGO",date:"Jun 3", days:15},
  {ticker:"LRCX",date:"Jul 29",days:71},
  {ticker:"NET", date:"Jul 30",days:72},
  {ticker:"AMAT",date:"Aug 13",days:86},
];

const statusColors = {
  good:  {bg:"bg-green-100", text:"text-green-700", dot:"bg-green-500", label:"On Track"},
  watch: {bg:"bg-yellow-100",text:"text-yellow-700",dot:"bg-yellow-500",label:"Watch"},
  risk:  {bg:"bg-red-100",   text:"text-red-700",   dot:"bg-red-500",  label:"Risk"},
};

const fmtUSD  = (n: number) => (n>=0?"+$":"-$")+Math.abs(n).toLocaleString(undefined,{maximumFractionDigits:0});
const fmtPct  = (n: number) => (n>=0?"+":"")+n.toFixed(2)+"%";
const fmtTime = (d: Date | null) => { if(!d) return null; return d.toLocaleDateString([],{day:"2-digit",month:"short",year:"numeric"})+" "+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}); };
const today   = () => new Date().toISOString().slice(0,10);

const calcPosition = (txns: Transaction[]): Position => {
  const buys: {shares:number;price:number}[] = [];
  let sharesHeld=0, costBasis=0, realisedPnL=0;
  for(const tx of [...txns].sort((a,b)=>a.date.localeCompare(b.date))) {
    if(tx.type==="buy"){
      buys.push({shares:tx.shares,price:tx.price});
      sharesHeld+=tx.shares;
      costBasis+=tx.shares*tx.price;
    } else {
      let toSell=tx.shares;
      sharesHeld-=tx.shares;
      while(toSell>0&&buys.length>0){
        const lot=buys[0];
        const sold=Math.min(toSell,lot.shares);
        realisedPnL+=sold*(tx.price-lot.price);
        costBasis-=sold*lot.price;
        lot.shares-=sold;
        toSell-=sold;
        if(lot.shares===0) buys.shift();
      }
    }
  }
  return {sharesHeld,avgEntry:sharesHeld>0?costBasis/sharesHeld:0,costBasis,realisedPnL};
};

const TabBar = ({tabs,active,onChange}: {tabs:string[];active:string;onChange:(t:string)=>void}) => (
  <div className="flex gap-1 bg-gray-800 rounded-lg p-1 overflow-x-auto">
    {tabs.map(t=>(
      <button key={t} onClick={()=>onChange(t)}
        className={`flex-1 py-2 text-xs font-semibold rounded-md capitalize whitespace-nowrap transition-all ${active===t?"bg-gray-600 text-white":"text-gray-400 hover:text-white"}`}>
        {t}
      </button>
    ))}
  </div>
);

const StockPicker = ({tickers,selected,onChange,stockData,refreshing}: {
  tickers:Ticker[];selected:Ticker;onChange:(t:Ticker)=>void;
  stockData:Record<Ticker,StockInfo>;refreshing:Record<Ticker,boolean>
}) => (
  <div className="grid grid-cols-4 gap-2">
    {tickers.map(t=>{
      const s=stockData[t]; if(!s) return null;
      const p=parseFloat(s.price)||0;
      const inE=p>=s.entryRange[0]&&p<=s.entryRange[1];
      return(
        <button key={t} onClick={()=>onChange(t)}
          className={`py-2.5 px-2 rounded-xl font-semibold transition-all text-center relative ${selected===t?"bg-white text-gray-900":"bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
          {refreshing[t]&&<div className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"/>}
          <div className="text-sm font-bold">{t}</div>
          <div className="text-xs font-normal opacity-60 truncate">{s.name.split(" ")[0]}</div>
          {inE&&<div className="text-xs text-green-400 mt-0.5">✓ Entry</div>}
        </button>
      );
    })}
  </div>
);

export default function StockTracker() {
  const [tickers,       setTickers]       = useState<Ticker[]>(()=>loadPersisted()?.tickers ?? DEFAULT_TICKERS);
  const [selected,      setSelected]      = useState<Ticker>(()=>(loadPersisted()?.tickers ?? DEFAULT_TICKERS)[0] ?? "");
  const [activeTab,     setActiveTab]     = useState("portfolio");
  const [stockData,     setStockData]     = useState<Record<Ticker,StockInfo>>(()=>loadPersisted()?.stockData ?? STATIC_FALLBACK);
  const [lastRefresh,   setLastRefresh]   = useState<Record<Ticker,Date|null>>({});
  const [refreshing,    setRefreshing]    = useState<Record<Ticker,boolean>>({});
  const [refreshErr,    setRefreshErr]    = useState<Record<Ticker,string|null>>({});
  const [notes,         setNotes]         = useState<Record<Ticker,string>>(()=>loadPersisted()?.notes ?? {});
  const [saveMsg,       setSaveMsg]       = useState<string|null>(null);
  const [fetchingPrices,setFetchingPrices]= useState(false);
  const [transactions,  setTransactions]  = useState<Record<Ticker,Transaction[]>>(()=>loadPersisted()?.transactions ?? DEFAULT_TX);
  const [txForm,  setTxForm]  = useState({date:today(),type:"buy" as "buy"|"sell",shares:"",price:"",note:""});
  const [txError, setTxError] = useState("");
  const [newTicker, setNewTicker] = useState("");
  const [manageErr, setManageErr] = useState("");

  // Persist the durable slices of state so counters survive a reload.
  useEffect(()=>{
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({tickers,stockData,transactions,notes}));
    } catch { /* storage full or unavailable — ignore */ }
  },[tickers,stockData,transactions,notes]);

  const numPrice = (t: Ticker) => parseFloat(stockData[t]?.price)||0;

  const applyPrices = (priceMap: Partial<Record<Ticker,number>>) => {
    setStockData(prev=>{
      const next={...prev};
      for(const [t,p] of Object.entries(priceMap) as [Ticker,number][])
        if(next[t]&&!isNaN(p)&&p>0) next[t]={...next[t],price:String(p)};
      return next;
    });
    setLastRefresh(prev=>{
      const next={...prev};
      for(const t of Object.keys(priceMap) as Ticker[]) next[t]=new Date();
      return next;
    });
  };

  const fetchLivePrices = async () => {
    if(tickers.length===0){setSaveMsg("Add a counter first");setTimeout(()=>setSaveMsg(null),3000);return;}
    setFetchingPrices(true);
    setSaveMsg("Fetching latest prices...");
    try {
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(tickers.join(","))}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||"Request failed");
      applyPrices(data);
      setSaveMsg(`✓ Updated ${Object.keys(data).length} prices`);
      setTimeout(()=>setSaveMsg(null),3000);
    } catch(e) {
      setSaveMsg(`Failed: ${(e as Error).message}`);
      setTimeout(()=>setSaveMsg(null),6000);
    }
    setFetchingPrices(false);
  };

  const refreshStock = async (ticker: Ticker) => {
    setRefreshing(r=>({...r,[ticker]:true}));
    setRefreshErr(e=>({...e,[ticker]:null}));
    try {
      const res = await fetch(`/api/stock/${ticker}`);
      const data = await res.json();
      if(!res.ok) throw new Error(data.error||"Request failed");
      setStockData(prev=>{
        const base=prev[ticker]??STATIC_FALLBACK[ticker]??makeDefaultStock(ticker);
        return {...prev,[ticker]:{...base,...data,ticker,name:base.name,targetAlloc:base.targetAlloc,price:base.price}};
      });
      setLastRefresh(r=>({...r,[ticker]:new Date()}));
    } catch(e) {
      setRefreshErr(er=>({...er,[ticker]:"Refresh failed — using cached data"}));
    }
    setRefreshing(r=>({...r,[ticker]:false}));
  };

  const refreshAll = () => tickers.forEach(t=>refreshStock(t));

  const addCounter = () => {
    const t=newTicker.trim().toUpperCase();
    if(!t){return;}
    if(!SYMBOL_RE.test(t)){setManageErr("Enter a valid symbol, e.g. AAPL");return;}
    if(tickers.includes(t)){setManageErr(`${t} is already tracked`);return;}
    setTickers(prev=>[...prev,t]);
    setStockData(prev=>prev[t]?prev:{...prev,[t]:makeDefaultStock(t)});
    setTransactions(prev=>prev[t]?prev:{...prev,[t]:[]});
    setNotes(prev=>t in prev?prev:{...prev,[t]:""});
    setNewTicker("");setManageErr("");setSelected(t);
  };

  const removeCounter = (t: Ticker) => {
    if(transactions[t]?.length && !window.confirm(`Remove ${t}? Its ${transactions[t].length} transaction(s) will be deleted.`)) return;
    const next=tickers.filter(x=>x!==t);
    setTickers(next);
    if(selected===t) setSelected(next[0] ?? "");
    setStockData(prev=>{const n={...prev};delete n[t];return n;});
    setTransactions(prev=>{const n={...prev};delete n[t];return n;});
    setNotes(prev=>{const n={...prev};delete n[t];return n;});
  };

  const moveCounter = (t: Ticker, dir: -1|1) => {
    setTickers(prev=>{
      const i=prev.indexOf(t), j=i+dir;
      if(i<0||j<0||j>=prev.length) return prev;
      const next=[...prev];
      [next[i],next[j]]=[next[j],next[i]];
      return next;
    });
  };

  const addTransaction = () => {
    const sh=parseFloat(txForm.shares),pr=parseFloat(txForm.price);
    if(!sh||sh<=0){setTxError("Enter a valid share count");return;}
    if(!pr||pr<=0){setTxError("Enter a valid price");return;}
    const pos=calcPosition(transactions[selected]);
    if(txForm.type==="sell"&&sh>pos.sharesHeld){setTxError(`Cannot sell ${sh} — only ${pos.sharesHeld} held`);return;}
    setTransactions(prev=>({...prev,[selected]:[...prev[selected],{id:Date.now(),date:txForm.date,type:txForm.type,shares:sh,price:pr,note:txForm.note}]}));
    setTxForm({date:today(),type:"buy",shares:"",price:"",note:""});
    setTxError("");
  };

  const saveToFile = () => {
    const data={tickers,stockData,transactions,notes,savedAt:new Date().toISOString()};
    const b64=btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2))));
    const a=document.createElement("a");
    a.href=`data:application/json;base64,${b64}`;
    a.download=`stock-tracker-${today()}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setSaveMsg("Saved!");setTimeout(()=>setSaveMsg(null),2000);
  };

  const loadFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target?.result as string);
        if(Array.isArray(data.tickers)&&data.tickers.length){
          setTickers(data.tickers);
          setSelected(data.tickers[0]);
        }
        if(data.stockData)    setStockData(data.stockData);
        if(data.transactions) setTransactions(data.transactions);
        if(data.notes)        setNotes(data.notes);
        setSaveMsg(`Loaded ${file.name}`);setTimeout(()=>setSaveMsg(null),3000);
      }catch{setSaveMsg("Error: invalid file");setTimeout(()=>setSaveMsg(null),3000);}
    };
    reader.readAsText(file);e.target.value="";
  };

  const loadPricesFromCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const lines=(ev.target?.result as string).split("\n").map((l:string)=>l.trim()).filter(Boolean);
        const updates: Partial<Record<Ticker,number>> = {};
        for(const line of lines){
          const parts=line.split(/[,\t]/).map((p:string)=>p.trim().replace(/"/g,""));
          if(parts.length<2)continue;
          const t=parts[0].toUpperCase() as Ticker;
          const p=parseFloat(parts[1]);
          if(tickers.includes(t)&&!isNaN(p)&&p>0) updates[t]=p;
        }
        if(!Object.keys(updates).length){setSaveMsg("No matching tickers in CSV");setTimeout(()=>setSaveMsg(null),3000);return;}
        applyPrices(updates);
        setSaveMsg(`✓ Updated ${Object.keys(updates).length} prices from CSV`);
        setTimeout(()=>setSaveMsg(null),3000);
      }catch{setSaveMsg("Error reading CSV");setTimeout(()=>setSaveMsg(null),3000);}
    };
    reader.readAsText(file);e.target.value="";
  };

  const allPos = tickers.reduce((acc,t)=>{acc[t]=calcPosition(transactions[t]??[]);return acc;},{} as Record<Ticker,Position>);
  const totalInvested   = tickers.reduce((s,t)=>s+allPos[t].costBasis,0);
  const totalCurrent    = tickers.reduce((s,t)=>s+allPos[t].sharesHeld*numPrice(t),0);
  const totalRealised   = tickers.reduce((s,t)=>s+allPos[t].realisedPnL,0);
  const totalUnrealised = totalCurrent-totalInvested;
  const cashRemaining   = PORTFOLIO_CASH-totalInvested-totalRealised;
  const totalPnL        = totalUnrealised+totalRealised;
  const totalPnLPct     = totalInvested>0?(totalPnL/totalInvested)*100:0;
  const stock           = stockData[selected] ?? makeDefaultStock(selected||"—");
  const price           = numPrice(selected);
  const pos             = allPos[selected] ?? calcPosition([]);
  const inEntry         = price>=stock.entryRange[0]&&price<=stock.entryRange[1];
  const belowStop       = price<stock.stopLossVal;
  const unrPnL          = pos.sharesHeld*price-pos.costBasis;
  const unrPct          = pos.costBasis>0?(unrPnL/pos.costBasis)*100:0;

  const keyLevels = [
    {label:"Stop Loss",     p:stock.stopLossVal,   color:"text-red-400"},
    {label:"Avg Entry",     p:pos.avgEntry||null,  color:"text-gray-300"},
    {label:"Current",       p:price,               color:"text-white",highlight:true},
    {label:"1st Trim",      p:stock.firstTrim,     color:"text-yellow-400"},
    {label:"2nd Trim",      p:stock.secondTrim,    color:"text-orange-400"},
    {label:"Analyst Target",p:stock.analystTarget, color:"text-green-400"},
  ].filter(l=>l.p);

  const RefreshBar = ({ticker}: {ticker:Ticker}) => (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={()=>refreshStock(ticker)} disabled={refreshing[ticker]}
        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${refreshing[ticker]?"bg-gray-700 text-gray-400 cursor-wait":"bg-blue-700 hover:bg-blue-600 text-white"}`}>
        {refreshing[ticker]?<><span className="animate-spin inline-block">⟳</span> Fetching...</>:<>⟳ Refresh {ticker}</>}
      </button>
      {lastRefresh[ticker]&&<span className="text-xs text-green-400">✓ {fmtTime(lastRefresh[ticker])}</span>}
      {refreshErr[ticker]&&<span className="text-xs text-red-400">{refreshErr[ticker]}</span>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 font-sans">
    <div className="max-w-3xl mx-auto space-y-4">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Stock Tracker</h1>
          <p className="text-gray-400 text-xs mt-0.5">Portfolio: ${PORTFOLIO_CASH.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold ${totalPnL>=0?"text-green-400":"text-red-400"}`}>{fmtUSD(Math.round(totalPnL))}</div>
          <div className="text-xs text-gray-400">{fmtPct(totalPnLPct)} total return</div>
          <div className="text-xs text-gray-500">Cash: ${Math.round(cashRemaining).toLocaleString()}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={saveToFile} className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg">💾 Save</button>
        <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer">
          📂 Load<input type="file" accept=".json" onChange={loadFromFile} className="hidden"/>
        </label>
        <label className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer">
          📊 CSV<input type="file" accept=".csv" onChange={loadPricesFromCSV} className="hidden"/>
        </label>
        <button onClick={fetchLivePrices} disabled={fetchingPrices}
          className={`flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${fetchingPrices?"bg-gray-700 opacity-60 cursor-wait":"bg-green-700 hover:bg-green-600"}`}>
          {fetchingPrices?<><span className="animate-spin inline-block">⟳</span> Fetching...</>:"🔄 Update Prices"}
        </button>
        <button onClick={refreshAll} disabled={Object.values(refreshing).some(Boolean)}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50">
          ⟳ Refresh All
        </button>
        {saveMsg&&<span className="text-xs text-green-400 font-semibold">{saveMsg}</span>}
      </div>

      <TabBar tabs={["portfolio","trades","stock","metrics","watchlist","strategy"]} active={activeTab} onChange={setActiveTab}/>

      {activeTab==="portfolio"&&(
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              {label:"Unrealised P&L",value:fmtUSD(Math.round(totalUnrealised)),sub:fmtPct(totalInvested>0?(totalUnrealised/totalInvested)*100:0)+" on open",color:totalUnrealised>=0?"text-green-400":"text-red-400"},
              {label:"Realised P&L",  value:fmtUSD(Math.round(totalRealised)),  sub:"From closed tranches",color:totalRealised>=0?"text-green-400":"text-red-400"},
              {label:"Cash Remaining",value:`$${Math.round(cashRemaining).toLocaleString()}`,sub:`of $${PORTFOLIO_CASH.toLocaleString()} total`,color:"text-blue-400"},
              {label:"Invested",      value:`$${Math.round(totalInvested).toLocaleString()}`,sub:"Open cost basis",color:"text-white"},
            ].map(i=>(
              <div key={i.label} className="bg-gray-800 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">{i.label}</div>
                <div className={`text-lg font-bold ${i.color}`}>{i.value}</div>
                <div className="text-xs text-gray-500">{i.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Manage Counters</div>
            <div className="flex gap-2">
              <input value={newTicker}
                onChange={e=>{setNewTicker(e.target.value.toUpperCase());setManageErr("");}}
                onKeyDown={e=>{if(e.key==="Enter")addCounter();}}
                placeholder="Add symbol, e.g. AAPL" maxLength={10}
                className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded outline-none focus:ring-1 focus:ring-blue-500 uppercase placeholder:normal-case placeholder:text-gray-500"/>
              <button onClick={addCounter}
                className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap">+ Add</button>
            </div>
            {manageErr&&<div className="text-xs text-red-400 mt-2">{manageErr}</div>}
            <div className="text-xs text-gray-500 mt-2">Use ▲ ▼ to reorder and ✕ to remove counters below.</div>
          </div>

          {tickers.length===0&&(
            <div className="bg-gray-800 rounded-xl p-6 text-center text-sm text-gray-400">
              No counters yet — add one above to start tracking.
            </div>
          )}
          {tickers.map((t,idx)=>{
            const s=stockData[t]??makeDefaultStock(t),p=allPos[t],cur=numPrice(t),val=p.sharesHeld*cur;
            const unr=val-p.costBasis,unrP=p.costBasis>0?(unr/p.costBasis)*100:0;
            const inE=cur>=s.entryRange[0]&&cur<=s.entryRange[1];
            const atStop=cur<s.stopLossVal&&p.sharesHeld>0;
            return(
              <div key={t} className={`bg-gray-800 rounded-xl p-4 border ${selected===t?"border-gray-400":"border-transparent"}`}>
                <div className="flex items-center justify-end gap-1 mb-2">
                  <button onClick={()=>moveCounter(t,-1)} disabled={idx===0} title="Move up"
                    className="w-7 h-7 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent text-xs">▲</button>
                  <button onClick={()=>moveCounter(t,1)} disabled={idx===tickers.length-1} title="Move down"
                    className="w-7 h-7 rounded text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent text-xs">▼</button>
                  <button onClick={()=>removeCounter(t)} title="Remove counter"
                    className="w-7 h-7 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 text-xs">✕</button>
                </div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={()=>setSelected(t)} className="font-bold text-white hover:text-blue-300">{t}</button>
                      <span className="text-xs text-gray-400">{s.name}</span>
                      {inE&&<span className="text-xs bg-green-900 text-green-400 px-1.5 py-0.5 rounded">Entry Zone</span>}
                      {atStop&&<span className="text-xs bg-red-900 text-red-400 px-1.5 py-0.5 rounded">⚠ Stop</span>}
                      {refreshing[t]&&<span className="text-xs text-blue-400 animate-pulse">Refreshing...</span>}
                      {lastRefresh[t]&&<span className="text-xs text-gray-500">↻ {fmtTime(lastRefresh[t])}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-400">Price</label>
                        <input type="number" step="0.01" value={stockData[t].price}
                          onChange={e=>setStockData(prev=>({...prev,[t]:{...prev[t],price:e.target.value}}))}
                          className="bg-gray-700 text-white text-sm font-semibold px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500 w-24"/>
                      </div>
                      <div className="text-xs text-gray-400 mt-3">
                        <div>{p.sharesHeld} shares held</div>
                        <div>Avg: {p.avgEntry>0?`$${p.avgEntry.toFixed(2)}`:"—"}</div>
                        {p.realisedPnL!==0&&<div className={p.realisedPnL>=0?"text-green-400":"text-red-400"}>Realised: {fmtUSD(Math.round(p.realisedPnL))}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {p.sharesHeld>0?(
                      <>
                        <div className="text-sm font-bold text-white">${Math.round(val).toLocaleString()}</div>
                        <div className={`text-xs font-semibold ${unr>=0?"text-green-400":"text-red-400"}`}>{fmtUSD(Math.round(unr))} ({fmtPct(unrP)})</div>
                        <div className="text-xs text-gray-400">unrealised</div>
                      </>
                    ):<div className="text-xs text-gray-500">No open position</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <button onClick={()=>refreshStock(t)} disabled={refreshing[t]}
                    className={`text-xs px-2 py-1 rounded ${refreshing[t]?"text-gray-500 cursor-wait":"text-blue-400 hover:text-blue-300"}`}>
                    {refreshing[t]?"⟳ Fetching...":"⟳ Refresh"}
                  </button>
                  {p.sharesHeld>0&&(
                    <div className="flex-1 ml-3">
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{width:`${Math.min(100,(val/s.targetAlloc)*100)}%`}}/>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab==="trades"&&(
        <div className="space-y-3">
          <StockPicker tickers={tickers} selected={selected} onChange={setSelected} stockData={stockData} refreshing={refreshing}/>
          <RefreshBar ticker={selected}/>
          <div className="grid grid-cols-3 gap-2">
            {[
              {label:"Shares Held",   value:pos.sharesHeld, color:"text-white",       fmt:(v:number)=>String(v)},
              {label:"Avg Entry",     value:pos.avgEntry,   color:"text-white",       fmt:(v:number)=>v>0?`$${v.toFixed(2)}`:"—"},
              {label:"Cost Basis",    value:pos.costBasis,  color:"text-white",       fmt:(v:number)=>v>0?`$${Math.round(v).toLocaleString()}`:"—"},
              {label:"Current Value", value:pos.sharesHeld*price, color:"text-white", fmt:(v:number)=>v>0?`$${Math.round(v).toLocaleString()}`:"—"},
              {label:"Unrealised P&L",value:unrPnL,color:unrPnL>=0?"text-green-400":"text-red-400",fmt:(v:number)=>pos.sharesHeld>0?`${fmtUSD(Math.round(v))} (${fmtPct(unrPct)})`:"—"},
              {label:"Realised P&L",  value:pos.realisedPnL,color:pos.realisedPnL>=0?"text-green-400":"text-red-400",fmt:(v:number)=>v!==0?fmtUSD(Math.round(v)):"—"},
            ].map(i=>(
              <div key={i.label} className="bg-gray-800 rounded-xl p-3">
                <div className="text-xs text-gray-400 mb-1">{i.label}</div>
                <div className={`text-sm font-bold ${i.color}`}>{i.fmt(i.value)}</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Add Transaction — {selected}</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className="text-xs text-gray-400 mb-1 block">Date</label>
                <input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))}
                  className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500"/></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Type</label>
                <div className="flex gap-2">
                  {(["buy","sell"] as const).map(tp=>(
                    <button key={tp} onClick={()=>setTxForm(f=>({...f,type:tp}))}
                      className={`flex-1 py-1.5 rounded text-sm font-semibold capitalize ${txForm.type===tp?(tp==="buy"?"bg-green-600 text-white":"bg-red-600 text-white"):"bg-gray-700 text-gray-400"}`}>
                      {tp}</button>
                  ))}</div></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Shares</label>
                <input type="number" placeholder="e.g. 100" value={txForm.shares} onChange={e=>setTxForm(f=>({...f,shares:e.target.value}))}
                  className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500"/></div>
              <div><label className="text-xs text-gray-400 mb-1 block">Price ($)</label>
                <input type="number" step="0.01" placeholder="e.g. 191.25" value={txForm.price} onChange={e=>setTxForm(f=>({...f,price:e.target.value}))}
                  className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500"/></div>
            </div>
            <div className="mb-2"><label className="text-xs text-gray-400 mb-1 block">Note (optional)</label>
              <input type="text" placeholder="e.g. Pre-earnings entry" value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))}
                className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500"/></div>
            {txError&&<div className="text-xs text-red-400 mb-2">{txError}</div>}
            <button onClick={addTransaction}
              className={`w-full py-2 rounded-lg text-sm font-semibold ${txForm.type==="buy"?"bg-green-600 hover:bg-green-500":"bg-red-600 hover:bg-red-500"} text-white`}>
              {txForm.type==="buy"?"+ Add Buy":"− Add Sell"}</button>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Transaction History — {selected}</div>
            {transactions[selected].length===0
              ?<div className="text-sm text-gray-500 text-center py-4">No transactions yet</div>
              :<div className="space-y-2">
                {[...transactions[selected]].sort((a,b)=>b.date.localeCompare(a.date)).map(tx=>(
                  <div key={tx.id} className={`rounded-lg p-3 border ${tx.type==="buy"?"border-green-800 bg-green-950":"border-red-800 bg-red-950"}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${tx.type==="buy"?"bg-green-600":"bg-red-600"} text-white uppercase`}>{tx.type}</span>
                        <span className="text-sm font-semibold text-white">{tx.shares} shares @ ${tx.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">${Math.round(tx.shares*tx.price).toLocaleString()}</span>
                        <button onClick={()=>setTransactions(prev=>({...prev,[selected]:prev[selected].filter(t=>t.id!==tx.id)}))} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-gray-400">{tx.date}</span>
                      {tx.note&&<span className="text-xs text-gray-400 italic">"{tx.note}"</span>}
                    </div>
                  </div>
                ))}
              </div>}
          </div>
          {pos.sharesHeld>0&&(
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">P&L at Key Levels — {pos.sharesHeld} shares @ ${pos.avgEntry.toFixed(2)}</div>
              {keyLevels.map(l=>{
                const g=((l.p??0)-pos.avgEntry)*pos.sharesHeld;
                const pct=pos.avgEntry>0?(((l.p??0)-pos.avgEntry)/pos.avgEntry)*100:0;
                return(
                  <div key={l.label} className={`flex items-center justify-between py-2 border-b border-gray-700 last:border-0 ${l.highlight?"bg-gray-700 rounded px-2 -mx-2":""}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold w-28 ${l.color}`}>{l.label}</span>
                      <span className="text-xs text-gray-400">${typeof l.p==="number"?l.p.toFixed(2):l.p}</span>
                    </div>
                    <div>
                      <span className={`text-xs font-bold ${g>=0?"text-green-400":"text-red-400"}`}>{fmtUSD(Math.round(g))}</span>
                      <span className={`text-xs ml-2 ${g>=0?"text-green-400":"text-red-400"}`}>({fmtPct(pct)})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab==="stock"&&(
        <div className="space-y-3">
          <StockPicker tickers={tickers} selected={selected} onChange={setSelected} stockData={stockData} refreshing={refreshing}/>
          <RefreshBar ticker={selected}/>
          <div className={`rounded-xl p-4 ${belowStop&&pos.sharesHeld>0?"bg-red-900 border border-red-700":"bg-gray-800"}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-400 mb-1">{stock.ticker} — Current Price</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-400 text-lg">$</span>
                  <input type="number" step="0.01" value={stock.price}
                    onChange={e=>setStockData(prev=>({...prev,[selected]:{...prev[selected],price:e.target.value}}))}
                    className="bg-gray-700 text-3xl font-bold text-white px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 w-36"/>
                </div>
                <div className="text-xs text-gray-500">52w: ${stock.low52}–${stock.high52}</div>
              </div>
              <div className="text-right space-y-1">
                <div className={`text-xl font-bold ${stock.analystTarget>price?"text-green-400":"text-red-400"}`}>{fmtPct(((stock.analystTarget-price)/price)*100)}</div>
                <div className="text-xs text-gray-400">to ${stock.analystTarget} target</div>
                <div className={`text-xs ${inEntry?"text-green-400":"text-gray-400"}`}>{inEntry?"✓ In Entry Zone":stock.entryLabel}</div>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Thesis</div>
            <p className="text-sm text-gray-200 leading-relaxed">{stock.thesis}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Key Risks</div>
            {stock.risks.map((r,i)=>(
              <div key={i} className="flex items-start gap-2 mb-2 last:mb-0">
                <span className="text-red-400 flex-shrink-0">▲</span>
                <span className="text-sm text-gray-300">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab==="metrics"&&(
        <div className="space-y-3">
          <StockPicker tickers={tickers} selected={selected} onChange={setSelected} stockData={stockData} refreshing={refreshing}/>
          <RefreshBar ticker={selected}/>
          {stock.metrics.map((m,i)=>{
            const sc=statusColors[m.status]||statusColors.watch;
            return(
              <div key={i} className="bg-gray-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-1">
                  <div className="text-sm font-semibold text-white">{m.label}</div>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}/>{sc.label}
                  </div>
                </div>
                <div className="text-lg font-bold text-white">{m.value}</div>
                <div className="text-xs text-gray-400 mt-1">Target: {m.target}</div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab==="watchlist"&&(
        <div className="space-y-3">
          <StockPicker tickers={tickers} selected={selected} onChange={setSelected} stockData={stockData} refreshing={refreshing}/>
          <RefreshBar ticker={selected}/>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Watch on {stock.earningsDate}</div>
            {stock.watchlist.map((item,i)=>(
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-700 last:border-0">
                <div className="w-5 h-5 rounded border border-gray-600 flex-shrink-0 mt-0.5"/>
                <span className="text-sm text-gray-200">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab==="strategy"&&(
        <div className="space-y-3">
          <StockPicker tickers={tickers} selected={selected} onChange={setSelected} stockData={stockData} refreshing={refreshing}/>
          <RefreshBar ticker={selected}/>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Staged Entry & Exit — {stock.ticker}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Current:</span>
                <input type="number" step="0.01" value={stock.price}
                  onChange={e=>setStockData(prev=>({...prev,[selected]:{...prev[selected],price:e.target.value}}))}
                  className="bg-gray-700 text-white text-sm font-bold px-2 py-1 rounded outline-none focus:ring-1 focus:ring-blue-500 w-24 text-right"/>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${inEntry?"bg-green-900 text-green-400":belowStop?"bg-red-900 text-red-400":"bg-gray-700 text-gray-300"}`}>
                  {inEntry?"In Entry":belowStop?"⚠ Stop":fmtPct(((price-stock.entryRange[0])/stock.entryRange[0])*100)+" from entry"}
                </span>
              </div>
            </div>
            {stock.strategy.map((item,i)=>(
              <div key={i} className="flex gap-3 items-start py-2.5 border-b border-gray-700 last:border-0">
                <div className={`${item.color} text-white text-xs px-2 py-1 rounded font-semibold w-20 text-center flex-shrink-0`}>{item.action}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{item.level}</div>
                  <div className="text-xs text-gray-400">{item.note}</div>
                  {item.rationale&&<div className="text-xs text-blue-400 mt-0.5 italic">⟳ {item.rationale}</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Notes — {stock.ticker}</div>
            <textarea value={notes[selected]} onChange={e=>setNotes(n=>({...n,[selected]:e.target.value}))}
              placeholder="Add your own notes..." className="w-full bg-gray-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 outline-none resize-none h-24"/>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4">
        <div className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Earnings Countdown</div>
        <div className="grid grid-cols-4 gap-2">
          {earningsSchedule.filter(e=>tickers.includes(e.ticker)).map(e=>{
            const pct=Math.max(0,Math.min(100,100-(e.days/90)*100));
            const barColor=e.days<=20?"bg-red-500":e.days<=45?"bg-yellow-500":"bg-blue-500";
            const numColor=e.days<=20?"text-red-400":e.days<=45?"text-yellow-400":"text-blue-400";
            return(
              <div key={e.ticker} className={`rounded-lg p-3 border flex flex-col items-center gap-1 ${e.ticker===selected?"border-white bg-gray-700":"border-gray-700"}`}>
                <div className="text-xs font-bold text-white">{e.ticker}</div>
                <div className={`text-2xl font-black ${numColor}`}>{e.days}</div>
                <div className="text-xs text-gray-400">days</div>
                <div className="w-full bg-gray-600 rounded-full h-1.5">
                  <div className={`${barColor} h-1.5 rounded-full`} style={{width:`${pct}%`}}/>
                </div>
                <div className="text-xs text-gray-500">{e.date}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-gray-600 pb-4">For informational purposes only. Not financial advice.</div>
    </div>
    </div>
  );
}
