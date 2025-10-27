import { trendEditUITag, trendEditUISlot, trendEditUIDone } from "TrendEdit";
import { trendPath, trendExportPath } from "_PATH"

/**
 * Maximale Anzahl der Trenditems
 * 
 * @type {number}
 */
export const TRENDMAX_ITEMS = 10;

const TrendIntern = {
  /**
   * Gibt an, ob die Konfiguration initialisiert wrude
   *
   * @type {boolean}
   */
  initConfig: false,


  /**
   * Wandelt ein "Date" in einen Datumsstring im Format YYYY-MM-DD um
   * 
   * @param {Date} date - Datum das umgewandelt werden soll
   * @returns {string} - Datum als String
   */
  GetStringByDate: function (date) {
    let str = `${date.getFullYear()}-${(`0${date.getMonth() + 1}`).slice(-2)}-${(`0${date.getDate()}`).slice(-2)}`;
    return str;
  },

  /**
   * Gibt das aktuelle Trend-Datum zurück
   * 
   * @returns {string} - Aktuelles Trend-Datum
   */
  GetTrendDate: function () {
    let date = new Date(Tags("Trend_Date").Read());
    return this.GetStringByDate(date);
  },

  /**
   * Initialisiert die Konfiguration aus der Datei
   * 
   * @returns {void}
   */
  InitalizeConfig: function () {

  },


  /**
   * Daten in die Kurvenanzeige laden laden
   * 
   * @returns {void}
   */
  LoadConfig: function (range) {
    // Edit Mode lesen

    // Config auslesen
    let tagName = "";



    try {
      //statements

      // Intervall prüfen und setzen
      const validRanges = ["1s", "10s", "60s", "10m"];
      const interval = validRanges.includes(range) ? range : "1s";

      // Aktualisieren
      for (let i = 0; i < TRENDMAX_ITEMS; i++) {

        tagName = Tags(`TrendConfig_TagNames[${i}]`).Read();
        HMIRuntime.Trace(`Trend::Tagname[${i}]=${tagName}`);
        // Prüfen ob im Tagname DB_Unified_HMILists_ drin ist
        if (tagName !== "") {
          // Trencontrol Quelle schreiben
          Screen.Items("TrendControl_1").TrendAreas[0].Trends[i].DataSourceY.Source = `HMI_RT_1::${tagName}.Value:Cyclic_${interval}`;
          Screen.Items("TrendControl_1").TrendAreas[0].Trends[i].ShowLoggedDataImmediately = true;
          HMIRuntime.Trace(`Trend::TrendControl_1...Source[${i}] = HMI_RT_1::${tagName}.Value:Cyclic_${interval}`);
        }
        else {
          HMIRuntime.Trace(`Trend::TrendControl_1...Source[${i}] = kein Tag -> Trend_DummyValue`);
          Screen.Items("TrendControl_1").TrendAreas[0].Trends[i].ShowLoggedDataImmediately = false;
          Screen.Items("TrendControl_1").TrendAreas[0].Trends[i].DataSourceY.Source = 'HMI_RT_1::Trend_DummyValue:Cyclic_1s';

          Tags(`TrendConfig_Visible[${i}]`).Write(false);
        }

      }

      // Tag schreiben
      Tags("Trend_Interval").Write(interval);
      HMIRuntime.Trace("Trend::Trend_Interval" + interval);


    }
    catch (ex) {
      //statements
      HMIRuntime.Trace(`Trend::LoadConfig Fehler bei Tagname=${tagName} : ${ex}`);
    }

  },

  /**
   * Konfiguration inkl. Cookie in einer Datei ablegen
   * 
   * @returns {void}
   */
  StoreConfig: function () {

  },

  /**
   * Schaltet Trend online oder offline
   * 
   * @returns {void}
   */
  SetTrendOnline: function (online) {
    try {
      if (online == true) {
        Tags("Trend_Running").Write(1);
      }
      else {
        Tags("Trend_Running").Write(0);
      }
      HMIRuntime.Trace(`Trend::SetTrendOnline = ${online}`);
    }
    catch (ex) {
      HMIRuntime.Trace(`Trend::SetTrendOnline Fehler: ${ex}`);
    }

  },


  /**
   * Handelt einen Click auf ein Trenditem am rechten Rand
   * 
   * @param {number} slot - ID des Trenitem auf das geklickt wurde
   * @returns {void}
   */
  TrendItemClick: function (slot) {
    try {

      let trendTagname = Tags(`TrendConfig_TagNames[${slot}]`).Read();
      let trendtext = Tags(`TrendConfig_Trendtexts[${slot}]`).Read();
      let trend = this;

      let emptyText = "";



      if (!Tags("Trend_EditMode").Read()) {
        //Kein Edit-Mode -> Sichtbarkeit toggeln
        if (trendtext !== emptyText) {

          trend.SetTrendOnline(false);

          let tag = Tags(`TrendConfig_Visible[${slot}]`);
          let visible = !tag.Read();
          tag.Write(visible);

          HMIRuntime.Timers.SetTimeout(function () {
            trend.SetTrendOnline(true);
          }, 1000);

        }
      } else {
        //EditMode

        UI.DataSet.Remove(trendEditUITag);
        UI.DataSet.Remove(trendEditUISlot);
        UI.DataSet.Remove(trendEditUIDone);

        // Text vom zu editierten Slot
        Tags("Trend_EditTagName").Write(trendTagname);

        UI.DataSet.Add(trendEditUISlot, slot);
        UI.DataSet.Add(trendEditUITag, trendTagname);
        UI.SysFct.ChangeScreen("POPUP_Trend_Edit", "../PopUp");

      }
    } catch (ex) {
      HMIRuntime.Trace(`Trend::TrendItemClick ${ex.message}`);
    }
  },

  /**
  * Exportiert Archivdaten als CSV-Datei
  * 
  * @returns {void}
  */
  TrendExportArchiv: function () {
    {


      try {
        
        // Liste Archivvariablen
        /**
         * Tagnamen der zu exportierenden Tags
         * @type {string[]}
         */
        let loggedTagNames = [];
        /**
         * Trendtexte der zu exportierenden Tags
         * @type {string[]}
         */
        let loggedTrendtexts = [];


        for (let i = 0; i < TRENDMAX_ITEMS; i++) {
          loggedTagNames[i] = Screen.Items("TrendControl_1").TrendAreas[0].Trends[i].DataSourceY.Source.toString();
          HMIRuntime.Trace(`Trend::ExportArchiv:: ${loggedTagNames[i]}`);
          loggedTrendtexts[i] = Tags(`TrendConfig_Trendtexts[${i}]`).Read();
          HMIRuntime.Trace(`Trend::Export Tagname[${i}]= ${loggedTrendtexts[i]}`);
        }

        const SEP = ";"; // CSV-Trennzeichen
        const DIR = "/media/simatic/X51/TrendExports"; // Zielverzeichnis auf SD-Karte
        const now = new Date();

        const FILL_INITIAL = false; // Anfangswerte leer lassen
        const MAX_HOLD_SEC = Infinity; // Letzten bekannten Wert unbegrenzt übernehmen

        // === Zeitbereich aus lesen ===  
        let start = new Date(UI.ActiveScreen.Items("TrendControl_1").TrendAreas[0].BottomTimeAxes[0].BeginTime);
        let end = new Date(UI.ActiveScreen.Items("TrendControl_1").TrendAreas[0].BottomTimeAxes[0].EndTime);

        // === Zeitraum im Trace anzeigen ===
        HMIRuntime.Trace("Export-Zeitraum: " + start + " bis " + end);

        // === Ungültige Zeitstempel melden ===
        if (!isValidDate(start)) {
          HMIRuntime.Trace("Startzeit ungültig: " + getPV(start));
        }
        if (!isValidDate(end)) {
          HMIRuntime.Trace("Endzeit ungültig: " + getPV(end));
        }
        if (!isValidDate(start) || !isValidDate(end) || start >= end) {
          HMIRuntime.Trace("Export abgebrochen: ungültige Zeitspanne.");
          return;
        }

        // === Alias-Tag-Paare parsen ===
        // Statt Parsen: benutze loggedTrendtexts als CSV-Header und
        // loggedTagNames (bereinigt) als Einträge für das Logging-TagSet.
        const aliases = loggedTrendtexts.map(t => (t !== undefined && t !== null) ? String(t) : "");

        // Mapping von Logging-Name (raw Source) -> Header-Text (Trendtext)
        const nameToAlias = new Map();
        const createList = [];
        for (let i = 0; i < loggedTagNames.length; i++) {
          const raw = String(loggedTagNames[i] || "").replace(/[\r]+/g, "").trim();
          if (!raw) continue;
          createList.push(raw);
          // Mappe die raw-Source (z.B. "Alias:TagName") auf den passenden Trendtext
          nameToAlias.set(raw, aliases[i] || raw);
          nameToAlias.set(aliases[i] || raw, aliases[i] || raw);
        }

        if (createList.length === 0) {
          HMIRuntime.Trace("Keine gültigen Logging-Quellen gefunden.");
          return;
        }

        const loggedSet = HMIRuntime.TagLogging.CreateLoggedTagSet(createList);

        // === Archivdaten lesen ===
        loggedSet.Read(start, end, 0)
          .then(results => {
            // Debug-Ausgabe aller gelesenen Werte
            for (const loggedTag of results) {
              HMIRuntime.Trace("Name:" + loggedTag.Name);
              // for (let loggedTagValue of loggedTag.Values) {
              //   HMIRuntime.Trace("Value:" + loggedTagValue.Value + " Quality:" + loggedTagValue.Quality + " TS:" + loggedTagValue.TimeStamp + " Flags:" + loggedTagValue.Flags);
              // }
            }

            // === Daten nach Sekunden gruppieren ===
            const rowsBySec = new Map();
            const toSecFloor = d => Math.floor(new Date(d).getTime() / 1000);

            for (const r of results) {
              const alias = nameToAlias.get(r.Name) || r.Name;
              HMIRuntime.Trace(`TagName: ${r.Name} → Alias: ${alias}`);
              const values = r.Values || [];
              for (const p of values) {
                const sec = toSecFloor(p.TimeStamp);
                if (isNaN(sec)) continue;
                if (!rowsBySec.has(sec)) rowsBySec.set(sec, { t: new Date(sec * 1000), vals: new Map() });
                rowsBySec.get(sec).vals.set(alias, p.Value);
              }
            }

            const secs = Array.from(rowsBySec.keys()).sort((a, b) => a - b);
            if (secs.length === 0) throw new Error("Keine Archivwerte im gewählten Zeitraum gefunden.");

            // === CSV-Zeilen vorbereiten ===
            const lastKnown = new Map();
            const header = ["Zeitstempel"].concat(aliases).join(SEP);
            const lines = [header];

            for (const s of secs) {
              const row = rowsBySec.get(s);
              const out = [formatDE(row.t)];

              for (const alias of aliases) {
                let cell;
                if (row.vals.has(alias)) {
                  const v = row.vals.get(alias);
                  lastKnown.set(alias, { v, sec: s });
                  cell = (v !== undefined && v !== null) ? v : "";
                } else if (lastKnown.has(alias)) {
                  const lk = lastKnown.get(alias);
                  cell = ((s - lk.sec) <= MAX_HOLD_SEC) ? lk.v : "";
                } else {
                  cell = FILL_INITIAL ? "" : "";
                }
                out.push(cell);
              }
              lines.push(out.join(SEP));
            }

            // === CSV-Datei schreiben ===
            const csv = lines.join("\n");
            // Lokalzeit ohne Millisekunden, Format: YYYY-MM-DD_HH-mm-ss
            const pad = n => String(n).padStart(2, '0');
            const file = `${DIR}/Archive_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.csv`;
            return HMIRuntime.FileSystem.WriteFile(file, csv, "utf8")
              .then(() => {
                HMIRuntime.Trace(`Archiv geschrieben: ${file}  (Zeilen: ${lines.length - 1})`);
                Tags("Trend_ExportDone").Write(true);
                UI.ActiveScreen.Items("txtExportDone").Text = `\u2714 -> : ${DIR}/${file}`
              });
          })
          .catch(err => {
            const msg = HMIRuntime.GetDetailedErrorDescription(err);
            HMIRuntime.Trace("Exportfehler: " + msg);
          });

      } catch (e) {
        HMIRuntime.Trace("Trend::ExportArchiv: Unerwarteter Fehler: " + (e && e.message ? e.message : e));
      }
    }

    // === Hilfsfunktionen ===
    function getPV(io) {
      try {
        return io && ("ProcessValue" in io) ? io.ProcessValue : (io?.Text ?? "");
      } catch {
        return "";
      }
    }
    function isValidDate(d) {
      return d instanceof Date && !isNaN(d.getTime());
    }
    function formatDE(d) {
      const p = n => String(n).padStart(2, "0");
      return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }
  }
}

export const TrendExport = {
  /**
   * Das Datum wurde geändert -> Konfig neu laden
   * 
   * @returns {void}
   */
  Event_DateChanged: function () {
    TrendIntern.LoadConfig();
  },

  /**
   * MAIN_Trend wird geöffnet
   * 
   * @param {WinCC.CustomWebControl} trendControl - Referenz auf das Weber-TrendControl
   * @returns {void}
   */
  Event_Loaded: function () {
    HMIRuntime.Tags.SysFct.SetTagValue("Trend_AutoScale", false);
    HMIRuntime.Tags.SysFct.SetTagValue("Trend_EnableRuler", false);
    HMIRuntime.Tags.SysFct.SetTagValue("Trend_EditMode", false);

  },

  /**
   * Linealwerte in HMI-Variablen übergeben
   * 
   * @param {string} json - Als JSON kodierte Linealwerte
   * @returns {void}
   */
  Event_RulerValues: function () {
    try {

    } catch (ex) {
      HMIRuntime.Trace(`Trend::Event_RulerValues ${ex.message}`);
    }
  },

  /**
   * Cookie von Weber-Trend-Control speichern
   * 
   * @param {string} json - Als JSON kodierte Linealwerte
   * @returns {void}
   */
  Event_StoreCookie: function () {

  },

  /**
   * MAIN_Trend wird geschlossen
   * 
   * @returns {void}
   */
  Event_Unoaded: function () {

  },

  /**
   * Weber-Trend-Control fragt neue Daten an
   * 
   * @returns {void}
   */
  Event_Update: function () {

  }
}

/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Button_TrendItemClick(slot) {
  TrendIntern.TrendItemClick(slot);
}
export function Event_LoadConfig(range) {

  TrendIntern.LoadConfig(range);
}
export function Button_TrendEdit() {

  // Tag invertieren
  HMIRuntime.Tags.SysFct.InvertBitInTag("Trend_EditMode", 0);

  // Edit Mode lesen und invertieren
  let editMode = Tags("Trend_EditMode").Read();

  try {

    // Logik
    if (editMode == true) {
      TrendIntern.SetTrendOnline(false);
      HMIRuntime.Trace("Trend::Button_TrendEdit:EditMode aktiv");
    } else {

      HMIRuntime.Trace("Trend::Button_TrendEdit:EditMode inaktiv");
      let range = Tags("Trend_Interval").Read();

      // Load Config
      TrendIntern.LoadConfig(range);

    }
  }
  catch (ex) {
    HMIRuntime.Trace("Trend::Button_TrendEdit: Fehler" + ex);
  }

  try {
    if (editMode == false) {
      // Online schalten
      HMIRuntime.Timers.SetTimeout(function () {
        TrendIntern.SetTrendOnline(true);
      }, 1000);
    }
  }
  catch (ex) {
    HMIRuntime.Trace("Trend::Button_TrendEdit: Fehler:" + ex);
  }

}
export function Event_SetTrendOnlineDelyed() {
  HMIRuntime.Timers.SetTimeout(function () {
    TrendIntern.SetTrendOnline(true);
  }, 1000);
}
export function Event_Trendexport() {
  TrendIntern.TrendExportArchiv();
}
