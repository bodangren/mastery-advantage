# GSE Knowledge Space

ที่เก็บนี้มีเลเยอร์ข้อมูล ไฟล์แมปปิ้ง และเครื่องมือสำหรับการมองเห็นข้อมูล ที่ขับเคลื่อนการถามคำถามแบบปรับตัวให้เข้ากับผู้เรียน (adaptive questioning) ในแอป [Reading Advantage](https://reading-advantage.com) และ [Primary Advantage](https://primary-advantage.com)

> **เป้าหมาย:** ใช้ [Global Scale of English (GSE)](https://www.english.com/gse) ร่วมกับ [Knowledge Space Theory (KST)](https://en.wikipedia.org/wiki/Knowledge_space) เพื่อนำเสนอคำถามให้กับผู้เรียนแต่ละคนในจุดที่ตรงกับความสามารถปัจจุบันของเขาอย่างพอดี — ไม่ง่ายจนเกินไป ไม่ยากจนเกินไป แต่อยู่ใน **ขอบนอก (outer fringe)** ของสิ่งที่เขาพร้อมจะเรียนรู้ต่อไป

---

## แนวคิดหลัก

ทั้งสองแอปสอนภาษาอังกฤษโดยให้ผู้เรียนอ่านบทความแล้วตอบคำถามความเข้าใจ ความท้าทายคือการเลือกบทความที่มีความยาวและความยาก *พอดี* กับผู้เรียนแต่ละคน

**Knowledge Space Theory (KST)** หรือ ทฤษฎีพื้นที่ความรู้ เป็นการสร้างแบบจำลองการเรียนรู้เป็นพื้นที่โครงสร้างของทักษะ (หรือ "objectives") "สถานะความรู้ (knowledge state)" ของผู้เรียนคือชุดของ objectives ที่เขาสามารถทำได้แล้ว **ขอบนอก (outer fringe)** ของสถานะนั้นคือชุดของ objectives ที่เขายังไม่สามารถทำได้ แต่มีทักษะพื้นฐานที่จำเป็นครบถ้วนแล้ว เหล่านี้คือ objectives ที่ผู้เรียน *พร้อม* จะเรียนรู้ — "ขอบของความสามารถ" ของเขา

ที่เก็บนี้มีหน้าที่:
1. **แมป (Map)** ทุก GSE objective เข้ากับระบบเลเวลภายในแอปของเรา (เลเวล PA สำหรับผู้เรียนระดับประถม, เลเวล RA สำหรับผู้เรียนระดับมัธยม)
2. **สร้างแบบจำลอง (Model)** ความสัมพันธ์แบบก่อนหน้า-ตามหลัง (prerequisite) ระหว่าง GSE objectives เป็นกราฟที่มีทิศทาง
3. **สร้างภาพ (Visualize)** กราฟนั้นเพื่อให้เราสามารถวิเคราะห์เส้นทางการเรียนรู้และตรวจสอบโครงสร้างได้

แอป Next.js (TypeScript) จะนำไฟล์ CSV แมปปิ้งและกราฟ knowledge-space ไปใช้ตัดสินใจว่าจะแสดงคำถามข้อใดต่อไป

---

## แอปของเรา

| แอป | กลุ่มผู้เรียน | GSE Framework | ระบบเลเวล | ช่วง GSE |
|-----|---------------|---------------|-----------|-----------|
| **Primary Advantage** | นักเรียนประถม (อายุ 6–11 ปี) | Young Learners | PA (Primary Advantage) | 10–70 |
| **Reading Advantage** | นักเรียนมัธยม (อายุ 11–18 ปี) | Adult Learners | RA (Reading Advantage) | 10–90 |

---

## โครงสร้างไฟล์

```
.
├── assets/                                   # รูปภาพสำหรับการแสดงผล
│   ├── adults-cover.png
│   ├── adults-group.png
│   ├── illustration.png
│   └── yl-cover.png
│
├── gse-md/                                   # ข้อมูลต้นฉบับ GSE (อ่านง่ายสำหรับมนุษย์)
│   ├── adult-learners/
│   │   ├── listening.md                      # Objectives การฟังสำหรับผู้ใหญ่ แบ่งตามช่วง GSE
│   │   ├── reading.md                        # Objectives การอ่านสำหรับผู้ใหญ่ แบ่งตามช่วง GSE
│   │   ├── speaking.md                       # Objectives การพูดสำหรับผู้ใหญ่ แบ่งตามช่วง GSE
│   │   └── writing.md                        # Objectives การเขียนสำหรับผู้ใหญ่ แบ่งตามช่วง GSE
│   ├── young-learners/
│   │   ├── listening.md                      # Objectives การฟังสำหรับเด็ก
│   │   ├── reading.md                        # Objectives การอ่านสำหรับเด็ก
│   │   ├── speaking.md                       # Objectives การพูดสำหรับเด็ก
│   │   └── writing.md                        # Objectives การเขียนสำหรับเด็ก
│   └── gse-all.json                          # รวมทุก objectives เป็น JSON array ไฟล์เดียว
│                                               (แหล่งข้อมูลหลักสำหรับสคริปต์สร้างกราฟ)
│
├── scripts/
│   ├── generate-knowledge-space.js           # สร้าง gse-knowledge-space.json จาก gse-all.json
│   └── build-standalone-viz.js               # ฝัง JSON เข้าไปใน HTML visualization แบบ standalone
│
├── gse-to-primary-advantage.csv              # แมปแต่ละคะแนน GSE (10–70) ไปยังเลเวล PA (1–14)
├── gse-to-reading-advantage.csv              # แมปแต่ละคะแนน GSE (10–90) ไปยังเลเวล RA (1–18)
│
├── gse-knowledge-space.json                  # กราฟ KST แบบเต็ม: โหนด (skills, units, standards)
│                                               และ edges (prerequisite_for, supports, contains, ฯลฯ)
│
├── index.html                                # GSE Learning Objectives Explorer (ค้นหา/กรอง objectives ทั้งหมด)
├── knowledge-space-viz.html                  # การมองเห็นกราฟแบบโต้ตอบด้วย D3
├── knowledge-space-viz-standalone.html       # การมองเห็นแบบเดียวกัน แต่ฝังข้อมูลแล้ว (ไม่ต้องใช้เซิร์ฟเวอร์)
│
├── GSE-Adults.pdf                            # PDF ต้นฉบับจาก Pearson (Adult Learners, 2019)
├── gse-learning-objectives-young-learners.pdf # PDF ต้นฉบับจาก Pearson (Young Learners, 2022)
│
└── README.md                                 # ไฟล์นี้
```

---

## การแมป GSE → เลเวลแอป

ไฟล์ CSV ทั้งสองเป็นไฟล์ที่สำคัญที่สุดสำหรับแอป ให้ข้อมูลสำหรับค้นหาโดยตรงจากคะแนน GSE ไปยังเลเวลปัจจุบันของผู้เรียน

### Primary Advantage (Young Learner GSE)

| เลเวล PA | ช่วง GSE |
|----------|-----------|
| 1 | 10–13 |
| 2 | 14–17 |
| 3 | 18–21 |
| 4 | 22–23 |
| 5 | 24–26 |
| 6 | 27–29 |
| 7 | 30–33 |
| 8 | 34–38 |
| 9 | 39–42 |
| 10 | 43–47 |
| 11 | 48–53 |
| 12 | 54–58 |
| 13 | 59–64 |
| 14 | 65–70 |

**ไฟล์:** `gse-to-primary-advantage.csv`  
**รูปแบบ:** `gse,pa_level` (หนึ่งแถวต่อหนึ่งคะแนน GSE)

### Reading Advantage (Adult GSE)

| เลเวล RA | ช่วง GSE |
|----------|-----------|
| 1 | 10–16 |
| 2 | 17–23 |
| 3 | 24–29 |
| 4 | 30–33 |
| 5 | 34–38 |
| 6 | 39–42 |
| 7 | 43–47 |
| 8 | 48–53 |
| 9 | 54–58 |
| 10 | 59–64 |
| 11 | 65–70 |
| 12 | 71–75 |
| 13 | 76–78 |
| 14 | 79–81 |
| 15 | 82–84 |
| 16 | 85–86 |
| 17 | 87–88 |
| 18 | 89–90 |

**ไฟล์:** `gse-to-reading-advantage.csv`  
**รูปแบบ:** `gse,ra_level` (หนึ่งแถวต่อหนึ่งคะแนน GSE)

---

## กราฟ Knowledge Space

`gse-knowledge-space.json` เป็นกราฟที่มีทิศทางซึ่งสร้างแบบจำลองโดเมนการเรียนรู้

### ประเภทโหนด (Node Types)

| ประเภท | คำอธิบาย | จำนวน |
|--------|---------|-------|
| `domain` | ราก: "Pearson GSE" | 1 |
| `content_group` | คู่ของ (age_group, skill) เช่น "Adults — Reading" | 8 |
| `standard` | เลเวล CEFR (Below A1, A1, A2, B1, ฯลฯ) | 10 |
| `instructional_unit` | ช่วงคะแนน GSE ภายใน content group เช่น "Adults Reading — A1 (22–29)" | ~40 |
| `skill` | แต่ละ "Can do" objective | ~2,000+ |

### ประเภทเส้นเชื่อม (Edge Types)

| ประเภท | ความหมาย |
|--------|---------|
| `contains` | โครงสร้าง: domain ครอบคลุม content groups, ซึ่งครอบคลุม units, ซึ่งครอบคลุม skills |
| `appears_in_context` | กลับด้านของ `contains`: skill ปรากฏอยู่ในบริบทของ unit ใด unit หนึ่ง |
| `aligned_to_standard` | Skill จัดแนวกับเลเวล CEFR |
| `supports` | ความสามารถร่วมกัน: skills ที่มีคะแนน GSE *เดียวกัน* ภายใน track เดียวกันสนับสนุนซึ่งกันและกัน |
| `prerequisite_for` | **เส้นเชื่อมสำคัญ** Skill A ต้องถูกเชี่ยวชาญก่อน จึงจะไปถึง Skill B ได้ เส้นเชื่อมเหล่านี้สร้างขึ้นแบบความน่าจะเป็นจากระยะห่างของคะแนน GSE (ย้อนหลัง 1–4 คะแนน) |

### วิธีสร้างกราฟ

รันคำสั่ง:

```bash
node scripts/generate-knowledge-space.js
```

สคริปต์นี้อ่าน `gse-md/gse-all.json` แล้วสร้าง `gse-knowledge-space.json`

สคริปต์สร้างเส้นเชื่อม prerequisite โดยใช้การสุ่มแบบมีเมล็ด (seeded sampling) ที่ผลลัพธ์ซ้ำได้:
- สำหรับแต่ละ skill ที่คะแนน X จะมองหา skills ใน track เดียวกัน (age, skill) ที่มีคะแนน X-4 ถึง X-1
- เลือก 3–5 ตัวก่อนหน้า โดยให้น้ำหนักกับคะแนนที่ใกล้กว่ามีโอกาสเป็น prerequisite มากกว่า
- ต้องมีอย่างน้อยหนึ่งตัวก่อนหน้าจาก X-1 (คะแนนที่ใกล้ที่สุด)
- น้ำหนักเส้นเชื่อมลดลงตามระยะทาง และความมั่นใจ (confidence) ถูกกำกับเป็น `high` / `medium` / `low` ตามลำดับ

สคริปต์ตรวจสอบความถูกต้องของกราฟ (ไม่มี ID ซ้ำ ไม่มีเส้นเชื่อมที่ขาดปลายทาง) และตรวจหาวงจร prerequisite (ต้องไม่มีวงจร)

---

## สำหรับนักพัฒนา (Next.js / TypeScript)

### การใช้งานการแมปเลเวล

การเชื่อมต่อที่ง่ายที่สุดคือการนำเข้าไฟล์ CSV เข้าแอปแล้วใช้แปลงเลเวลแอปของผู้เรียนเป็นช่วง GSE (หรือกลับกัน) เมื่อดึงบทความหรือคำถาม

```typescript
// ตัวอย่าง: โหลดแมปปิ้งเข้า Map<number, number>
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const csv = fs.readFileSync('./gse-to-primary-advantage.csv', 'utf-8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

const gseToPa = new Map<number, number>();
for (const row of records) {
  gseToPa.set(parseInt(row.gse), parseInt(row.pa_level));
}

// หาเลเวล PA สำหรับผู้เรียนที่ได้คะแนน GSE 34
const level = gseToPa.get(34); // => 8
```

### การใช้งานกราฟ Knowledge Space

สำหรับการถามคำถามแบบปรับตัว คุณจะต้อง:

1. **ติดตามสถานะความรู้ของผู้เรียน** — ชุดของ skill IDs ที่เขาได้แสดงให้เห็นว่าเชี่ยวชาญแล้ว
2. **คำนวณขอบนอก (outer fringe)** — ทุก skills ที่มี prerequisite ครบถ้วนอยู่ในสถานะความรู้ของผู้เรียน แต่เขายังไม่เชี่ยวชาญ
3. **กรองตามช่วง GSE** — จำกัดขอบนอกให้เหลือเฉพาะ skills ที่อยู่ในเลเวลแอปปัจจุบันของผู้เรียน (ใช้ไฟล์ CSV แมปปิ้ง)
4. **เลือกบทความ/คำถาม** — เลือกบทความที่ฝึกฝนหนึ่งใน skills เหล่านั้น

รูปแบบกราฟเป็น JSON ธรรมดา แต่ละโหนด `skill` มี `id` ที่ไม่ซ้ำกัน ฟิลด์ `difficulty` (0–1 ปรับมาจาก GSE 10–90) และ `metadata.gseScore` เส้นเชื่อม (edges) เป็น array แบบ flat ที่มี `sourceId`, `targetId` และ `type`

```typescript
// โค้ดตัวอย่างสำหรับคำนวณ outer fringe
function getOuterFringe(studentState: Set<string>, graph: Graph): SkillNode[] {
  const mastered = studentState;
  const skills = graph.nodes.filter(n => n.kind === 'skill');
  const prereqEdges = graph.edges.filter(e => e.type === 'prerequisite_for');

  // สร้างแมป: skillId -> ชุดของ skillIds ที่เป็น prerequisite
  const prereqsFor = new Map<string, Set<string>>();
  for (const edge of prereqEdges) {
    if (!prereqsFor.has(edge.targetId)) prereqsFor.set(edge.targetId, new Set());
    prereqsFor.get(edge.targetId)!.add(edge.sourceId);
  }

  return skills.filter(skill => {
    if (mastered.has(skill.id)) return false; // เชี่ยวชาญแล้ว
    const prereqs = prereqsFor.get(skill.id);
    if (!prereqs) return true; // ไม่มี prerequisite = ตัวเลือกในขอบนอก
    return [...prereqs].every(p => mastered.has(p)); // prerequisite ทั้งหมดเชี่ยวชาญแล้ว
  });
}
```

---

## การแสดงผลข้อมูล (Visualizations)

### GSE Learning Objectives Explorer

เปิด `index.html` ในเบราว์เซอร์เพื่อค้นหา กรอง และสำรวจ objectives GSE ทั้งหมด เหมาะสำหรับทีมคอนเทนต์และผู้ออกแบบหลักสูตร

### การมองเห็นกราฟ Knowledge Space

เปิด `knowledge-space-viz.html` (ต้องใช้เซิร์ฟเวอร์ท้องถิ่นเพื่อดึง `gse-knowledge-space.json`) หรือ `knowledge-space-viz-standalone.html` (ใช้งานจาก `file://` ได้เพราะฝังข้อมูลแล้ว)

นี่เป็นกราฟแบบ force-directed โต้ตอบด้วย D3 ที่แสดงโครงสร้าง prerequisite มีประโยชน์สำหรับ:
- ตรวจสอบว่าเส้นเชื่อมที่สร้างขึ้นมีความหมายหรือไม่
- ระบุ skills ที่ไม่มีเส้นเชื่อม (orphaned) หรือกลุ่มที่ผิดปกติ
- อธิบายแนวคิด KST ให้กับผู้มีส่วนได้ส่วนเสีย (stakeholders)

เพื่อสร้าง standalone version ใหม่หลังจากอัปเดตกราฟ:

```bash
node scripts/build-standalone-viz.js
```

---

## แหล่งข้อมูลต้นฉบับ

ทุก objectives มาจาก **Global Scale of English Learning Objectives** ของ Pearson:
- **Adult Learners** — ฉบับปี 2019 (`GSE-Adults.pdf`)
- **Young Learners** — ฉบับปี 2022 (`gse-learning-objectives-young-learners.pdf`)

ไฟล์ markdown ใน `gse-md/` สร้างขึ้นจาก PDF เหล่านี้เพื่อให้ง่ายต่อการบำรุงรักษา `gse-all.json` เป็นการรวบรวมในรูปแบบที่เครื่องอ่านได้ของทั้งสี่ทักษะสำหรับทั้งสองเฟรมเวิร์ก

---

## การมีส่วนร่วม

- **เพื่ออัปเดตข้อมูล GSE:** แก้ไขไฟล์ `.md` ที่เกี่ยวข้องใน `gse-md/` จากนั้นสร้าง `gse-all.json` และกราฟ knowledge space ใหม่
- **เพื่อเปลี่ยนแมปปิ้งเลเวล:** แก้ไขไฟล์ CSV โดยตรง หรือสร้างใหม่จากคำนิยามเลเวล
- **เพื่อแก้ไขตรรกะ prerequisite:** แก้ไข `scripts/generate-knowledge-space.js` (เช่น ปรับ `PREREQ_DISTANCE_MAX`, `PREREQ_MIN` หรือฟังก์ชันน้ำหนัก)

ควรตรวจสอบความถูกต้องของกราฟเสมอหลังจากสร้างใหม่ — สคริปต์จะล้มเหลวหากพบวงจรหรือเส้นเชื่อมที่ขาดปลายทาง
