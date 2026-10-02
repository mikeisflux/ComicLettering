/* Help → Report a bug… — the studio's bug-report dialog. Hands the shared
   form the live context: this book's shape, the selection, and a render of
   the current page (thumbOf, the same pipeline as the library thumbnail). */
import BugReportForm from "@/components/BugReportForm";
import { EditorCtx } from "./ctx";

export function renderBugDialog(ed: EditorCtx) {
  if (!ed.showBugReport) return null;
  const close = () => ed.setShowBugReport(false);
  const context = () => {
    const d = ed.doc;
    const p = ed.page;
    const kinds: Record<string, number> = {};
    for (const pg of d?.pages ?? []) for (const e of pg.els) kinds[e.type] = (kinds[e.type] || 0) + 1;
    return {
      project: ed.current ? `${ed.current.name} (${ed.current.id.slice(-8)})` : "(unsaved)",
      demo: ed.demo,
      pages: d?.pages.length ?? 0,
      pageIndex: ed.pageIndex + 1,
      pageSize: p ? `${p.w}×${p.h}` : "",
      bleed: p?.bleed ?? 0,
      elements: kinds,
      selected: ed.selEl ? `${ed.selEl.type}${"kind" in ed.selEl ? ":" + ed.selEl.kind : ""}` : "",
      editing: !!ed.editingId,
      zoom: Math.round(ed.zoom * 100) / 100,
      spread: ed.spreadPrint ? "print" : ed.spreadLayout.length > 1 ? "spread" : "single",
      panels: `${ed.winHide.left ? "L-hidden" : "L"} ${ed.winHide.right ? "R-hidden" : "R"} ${ed.winHide.tray ? "tray-hidden" : "tray"}`,
      status: ed.status,
    };
  };
  const screenshot = async () => {
    try { return await ed.thumbOf(ed.pageIndex); } catch { return null; }
  };
  return (
    <div className="setupOverlay" style={{ zIndex: 3500 }} onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="setupDlg" style={{ width: 520 }}>
        <div className="setupTitle">Report a bug</div>
        <div className="setupBody" style={{ flexDirection: "column" }}>
          <BugReportForm compact context={context} screenshot={screenshot} onDone={close} onCancel={close} />
        </div>
      </div>
    </div>
  );
}
