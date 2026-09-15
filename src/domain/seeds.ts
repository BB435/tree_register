import type { Category, Tag, Snapshot, SourceNode } from "../shared/types";
const groups: Record<string, string[]> = {
  "公開・管理": [
    "オープンデータ",
    "公開資料",
    "庁内共有",
    "更新予定",
    "確定値",
    "速報値",
    "参考資料",
    "統計",
    "地域情報",
    "行政資料",
    "調査結果",
    "集計表"
  ],
  "人口・暮らし": [
    "人口",
    "世帯",
    "出生",
    "死亡",
    "転入",
    "転出",
    "年齢構成",
    "高齢者",
    "子育て",
    "住民生活",
    "移住",
    "国勢調査"
  ],
  "環境・自然": [
    "環境",
    "大気",
    "水質",
    "土壌",
    "騒音",
    "振動",
    "気温",
    "降水量",
    "森林",
    "河川",
    "生物多様性",
    "廃棄物"
  ],
  "交通・都市": [
    "交通",
    "道路",
    "鉄道",
    "バス",
    "自転車",
    "歩行者",
    "交通量",
    "駐車場",
    "都市計画",
    "土地利用",
    "公共施設",
    "上下水道"
  ],
  "防災・安全": [
    "防災",
    "地震",
    "洪水",
    "土砂災害",
    "津波",
    "避難所",
    "防災設備",
    "火災",
    "救急",
    "犯罪",
    "交通事故",
    "ハザードマップ"
  ],
  "産業・経済": [
    "産業",
    "経済",
    "農業",
    "林業",
    "水産業",
    "製造業",
    "商業",
    "観光",
    "雇用",
    "事業所",
    "消費",
    "貿易"
  ],
  "健康・福祉": [
    "健康",
    "福祉",
    "医療",
    "病院",
    "診療所",
    "健診",
    "感染症",
    "介護",
    "障害福祉",
    "生活支援",
    "保険",
    "年金"
  ],
  "教育・文化": [
    "教育",
    "学校",
    "保育所",
    "図書館",
    "博物館",
    "文化財",
    "スポーツ",
    "生涯学習",
    "児童",
    "学生",
    "文化活動",
    "公園"
  ],
  "行政・財政": [
    "行政",
    "財政",
    "予算",
    "決算",
    "税収",
    "歳出",
    "補助金",
    "契約",
    "入札",
    "議会",
    "選挙",
    "行政区域"
  ],
  "形式・頻度": [
    "CSV",
    "Excel",
    "JSON",
    "XML",
    "PDF",
    "GeoJSON",
    "画像",
    "時系列",
    "日次",
    "月次",
    "四半期",
    "年次"
  ],
  "年度": [
    "2020年度",
    "2021年度",
    "2022年度",
    "2023年度",
    "2024年度",
    "2025年度",
    "2026年度",
    "2027年度",
    "2028年度",
    "2029年度",
    "2030年度",
    "2031年度"
  ]
};
export function seedTags() {
  const categories: Category[] = Object.keys(groups).map((name,i)=>({id:'category-'+i,name}));
  const tags: Tag[] = categories.flatMap(c=>groups[c.name].map((label,i)=>({id:c.id+'-tag-'+i,label,categoryId:c.id})));
  return {categories,tags};
}
export function sampleState(): Snapshot {
 const {categories,tags}=seedTags();const nodes:SourceNode[]=[];
 const add=(name:string,kind:'folder'|'file',parentId:string|null,title=name,labels:string[]=[],mode?:SourceNode['mode'])=>{
 const parent=nodes.find(n=>n.id===parentId);const sourcePath=parent?parent.sourcePath+'/'+name:name;
 const node:SourceNode={id:'sample-'+nodes.length,name,kind,parentId,title,description:'地域の公開データを整理したサンプルです。',tagIds:tags.filter(t=>labels.includes(t.label)).map(t=>t.id),sourcePath,absolutePath:'demo:/'+sourcePath,depth:parent?parent.depth+1:1,mode:mode??(kind==='file'?'dataset':parentId?'sub':'top'),inherit:false};nodes.push(node);return node.id;
 };
 const root=add('地域データアーカイブ','folder',null,'地域データアーカイブ',['オープンデータ','地域情報']);
 const population=add('01_人口・世帯','folder',root,'人口・世帯統計',['統計','2026年度']);
 add('人口推移_2026.csv','file',population,'地域別人口の推移（2026年）',['統計']);
 const household=add('世帯数.csv','file',population);nodes.find(n=>n.id===household)!.inherit=true;
 const environment=add('02_環境','folder',root,'環境観測データ',['環境']);
 add('大気観測.csv','file',environment,'大気観測結果',['環境']);
 add('交通量調査.xlsx','file',root,'交通量調査',['交通'],'standalone');
 add('README.txt','file',root,'README',[],'exclude');
 add('作業用','folder',root,'作業用',[],'exclude');
 return {nodes,tags,categories,registry:[{sourceId:'demo',path:'地域データアーカイブ/01_人口・世帯',catalogId:'CAT-2026-0042',title:'人口・世帯統計',registeredAt:'2026-09-01'}],settings:{maxDepth:3,sourceId:'demo',sourceRoots:{demo:'demo:/'}},rootPath:'demo:/地域データアーカイブ',demo:true,failure:null};
}
