const fs = require('fs');
const path = require('path');

// ── Fix performance modal in students/page.js ──
const studFile = path.join(__dirname, 'app/(dashboard)/students/page.js');
let studContent = fs.readFileSync(studFile, 'utf8');

// Find the performance modal block by start + end markers and replace
const modalStart = studContent.indexOf('      {/* ─── Performance History Modal ─── */}');
const modalEnd = studContent.indexOf('      </Modal>\n    </div>\n  );\n}') + '      </Modal>'.length;

if (modalStart !== -1 && modalEnd > modalStart) {
  const newModal = `      {/* ─── Performance History Modal ─── */}
      <Modal open={perfModalOpen} onClose={() => setPerfModalOpen(false)} title="Test Performance History">
        <div className="modal-body !p-0 max-h-[560px] overflow-y-auto">
          {perfStudent && (
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-slate-700 text-white flex items-center justify-center rounded-lg font-bold text-lg">
                    {(perfStudent.user_id?.name || "?")[0]}
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-900 leading-none">{perfStudent.user_id?.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {perfStudent.section_id?.class_id?.name ? perfStudent.section_id.class_id.name + " · " : ""}
                      {perfStudent.section_id?.name || "No Section"}
                    </p>
                 </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Avg Score</div>
                <div className="text-xl font-bold text-slate-800">
                  {perfHistory.length > 0
                    ? Math.round(perfHistory.reduce((s, r) => s + (r.percentage || 0), 0) / perfHistory.length) + "%"
                    : "—"}
                </div>
              </div>
            </div>
          )}
          <div className="p-4 space-y-3">
            {perfLoading ? (
               <div className="py-16 flex flex-col items-center justify-center gap-3 opacity-50">
                  <Activity size={28} className="animate-spin text-slate-400" />
                  <p className="text-sm font-medium">Loading results…</p>
               </div>
            ) : perfHistory.length > 0 ? (
               perfHistory.map((res, i) => {
                 const pct = res.percentage ?? 0;
                 const isGood = pct >= 75;
                 const isPassing = pct >= 50;
                 return (
                   <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                     <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                       <div>
                         <div className="font-bold text-gray-800 text-sm leading-none">{res.test_id?.name || "Unknown Test"}</div>
                         <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                           {res.test_id?.date
                             ? new Date(res.test_id.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                             : "—"}
                           {res.test_id?.section ? " · " + res.test_id.section : ""}
                         </div>
                       </div>
                       <div className="flex items-center gap-2 flex-shrink-0">
                         <span className="font-black text-slate-800 text-sm">{res.total_earned ?? "—"} / {res.total_marks ?? "—"}</span>
                         <span className={isGood ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700" : isPassing ? "text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" : "text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600"}>{pct}%</span>
                       </div>
                     </div>
                     {res.subject_marks && res.subject_marks.length > 0 ? (
                       <div className="divide-y divide-gray-50">
                         {res.subject_marks.map((sm, j) => (
                           <div key={j} className="flex items-center gap-3 px-4 py-2 text-xs">
                             <span className="font-medium text-gray-600 w-28 truncate flex-shrink-0">{sm.subject}</span>
                             <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                               <div className={sm.pct >= 75 ? "h-full rounded-full bg-emerald-500" : sm.pct >= 50 ? "h-full rounded-full bg-amber-400" : "h-full rounded-full bg-red-400"} style={{ width: sm.pct + "%" }} />
                             </div>
                             <span className="font-mono text-gray-700 font-semibold w-16 text-right flex-shrink-0">{sm.marks} / {sm.max_marks}</span>
                             <span className={sm.pct >= 75 ? "font-bold w-9 text-right flex-shrink-0 text-emerald-600" : sm.pct >= 50 ? "font-bold w-9 text-right flex-shrink-0 text-amber-600" : "font-bold w-9 text-right flex-shrink-0 text-red-500"}>{sm.pct}%</span>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="px-4 py-2 text-xs text-gray-400 italic">No subject breakdown available</div>
                     )}
                   </div>
                 );
               })
            ) : (
               <div className="py-16 text-center text-gray-400 border-dashed border border-gray-100 rounded-lg">
                  <BarChart3 size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">No test results found for this student.</p>
               </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={() => setPerfModalOpen(false)} className="btn-primary w-full">Close View</button>
        </div>
      </Modal>`;

  studContent = studContent.substring(0, modalStart) + newModal + studContent.substring(modalEnd);
  fs.writeFileSync(studFile, studContent, 'utf8');
  console.log('Students page performance modal patched successfully. chars:', studContent.length);
} else {
  console.error('Could not find modal markers. modalStart=' + modalStart + ' modalEnd=' + modalEnd);
}
