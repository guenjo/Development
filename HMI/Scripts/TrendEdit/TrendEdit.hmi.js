/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Variablenname der Trendvariable
 *
 * @type {string}
 */
export const trendEditUITag = "trendEditUITag";


/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Slot der geändert werden soll (Element auf der rechten Seite)
 *
 * @type {string}
 */
export const trendEditUISlot = "trendEditUISlot";

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Änderung abgeschlossen und Erfolgreich oder nicht
 *
 * @type {string}
 */
export const trendEditUIDone = "trendEditUIDone";

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Einheit des zu speichernden Trends
 *
 * @type {string}
 */
export const trendEditUIUnit = "trendEditUIUnit";

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Einheit des zu speichernden Trends
 *
 * @type {string}
 */
export const trendEditUIText = "trendEditUIText";

/**
 * Maximale Anzahl an Trendnamen pro Seite
 *
 * @type {number}
 */
const TRENDEDITMAXELEMENTS = 8;


const TrendEditInternal = {
  /**
   * Namen (Gruppen - Name Nummer [Unit]) für die Liste der auszuwählenden Trends
   *
   * @type {Array}
   */
  trendNames: [],

  /**
   * Füllt das Array "trendNames" mit den sprachabhängigen Texten
   * 
   * @returns {void}
   */
  BuildNames: function() {
    try {
      this.trendNames = [];
  
      let ts = Tags.CreateTagSet();
    
      for (let i = 1; i < 100; i++) {
        ts.Add(`DB_Unified_HMILists_TempZone[${i}].Group`);
        ts.Add(`DB_Unified_HMILists_TempZone[${i}].Name`);
        ts.Add(`DB_Unified_HMILists_TempZone[${i}].SubNum`);
        ts.Add(`DB_Unified_HMILists_TempZone[${i}].Unit`);
      }
    
      for (let i = 1; i < 100; i++) {
        ts.Add(`DB_Unified_HMILists_Act[${i}].Group`);
        ts.Add(`DB_Unified_HMILists_Act[${i}].Name`);
        ts.Add(`DB_Unified_HMILists_Act[${i}].SubNum`);
        ts.Add(`DB_Unified_HMILists_Act[${i}].Unit`);
      }
    
      ts.Read();
    
      for (let i = 1; i < 100; i++) {
        let group = ts.Item(`DB_Unified_HMILists_TempZone[${i}].Group`).Value;
    
        if (group > 0) {
          let name = ts.Item(`DB_Unified_HMILists_TempZone[${i}].Name`).Value;
          let num = ts.Item(`DB_Unified_HMILists_TempZone[${i}].SubNum`).Value;
          let unit = ts.Item(`DB_Unified_HMILists_TempZone[${i}].Unit`).Value;
    
          let grouptxt = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
          let nametxt = HMIRuntime.Resources.TextLists("@Default.Zones").Item(name).Item(HMIRuntime.Language);
          let numtxt = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
          let unittxt = HMIRuntime.Resources.TextLists("@Default.Units").Item(unit).Item(HMIRuntime.Language);
    
          this.trendNames.push({text: `${grouptxt} - ${nametxt}${numtxt} [${unittxt}]`, varName: `DB_Unified_HMILists_TempZone[${i}]`, unit: unit});
        }
      }
    
      for (let i = 1; i < 100; i++) {
        let group = ts.Item(`DB_Unified_HMILists_Act[${i}].Group`).Value;
        if (group > 0) {
          let name = ts.Item(`DB_Unified_HMILists_Act[${i}].Name`).Value;
          let num = ts.Item(`DB_Unified_HMILists_Act[${i}].SubNum`).Value;
          let unit = ts.Item(`DB_Unified_HMILists_Act[${i}].Unit`).Value;
          
          let grouptxt = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
          let nametxt = HMIRuntime.Resources.TextLists("@Default.Indications").Item(name).Item(HMIRuntime.Language);
          let numtxt = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
          let unittxt = HMIRuntime.Resources.TextLists("@Default.Units").Item(unit).Item(HMIRuntime.Language);
          this.trendNames.push({text: `${grouptxt} - ${nametxt}${numtxt} [${unittxt}]`, varName: `DB_Unified_HMILists_Act[${i}]`, unit: unit});
        }
        
      }
    } catch (ex) {
      HMIRuntime.Trace(`TrendEdit::BuildNames ${ex.message}`);
    }
  },

  /**
   * POPUP_TrendEdit speichern und schließen
   * 
   * @returns {void}
   */
  Save: function() {
    //UI.DataSet.Add(trendEditUIDone, 2);

    try {
      // Slot der gespeichert wird
      let dynIndex  = UI.DataSet.Item(trendEditUISlot);
      let tagNameSlot = UI.DataSet.Item(trendEditUITag);
      let trendUnit = UI.DataSet.Item(trendEditUIUnit);
      let trendText = UI.DataSet.Item(trendEditUIText);
  
      // Variablennamen holen mit Index
      let tagName_TrendText = `TrendConfig_Trendtexts[${dynIndex}]`;
      let tagName_TagName = `TrendConfig_TagNames[${dynIndex}]`;
      let tagName_TrendUnit = `TrendConfig_Units[${dynIndex}]`;
  
      // Config lesen
      //let trendtext = Tags("Trend_Edittext_Selected").Read();
      //let trendUnit = Tags("Trend_EditUnit").Read();
  
      // Config HMI-Variablen schreiben
      Tags(tagName_TrendText).Write(trendText);
      Tags(tagName_TagName).Write(tagNameSlot);
      Tags(tagName_TrendUnit).Write(trendUnit);
  
  
      UI.SysFct.ChangeScreen("POPUP_None", "../PopUp");
    }
    catch (ex) {
      //statements
      HMIRuntime.Trace(`TrendEdit::Save ${ex.message}`);
    }


  },
  
  /**
   * POPUP_TrendEdit NICHT speichern und schließen
   * 
   * @returns {void}
   */
  Abort: function() {
    UI.DataSet.Add(trendEditUIDone, 1);
    HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp");
  },
  
  /**
   * POPUP_TrendEdit Trend entfernen und schließen
   * 
   * @returns {void}
   */
  Delete: function() {
    
    // Select Item -1
    this.SelectItem(-1);

    // Übernehmen
    this.Save();

    // PopUp schließen
    UI.SysFct.ChangeScreen("POPUP_None", "../PopUp");

    
  },

  /**
   * POPUP_TrendEdit Seite wechseln
   * 
   * @param {boolean} init - Initialer Aufruf der Funktion
   * @returns {void}
   */
  ChangePage: function(init) {  
    try {
      let selection = Tags("Trend_EditTagName").Read();
      
    
      let ts = Tags.CreateTagSet(["Trend_EditPageAct", "Trend_EditSelected"]);
      ts.Read();
      let act = ts[0].Value;
      let selected = ts[1].Value;
    
      if (init) {
        let initIndex = this.trendNames.findIndex(trend => trend.varName == selection);
        if (initIndex >= 0) {
          act = Math.floor(initIndex / TRENDEDITMAXELEMENTS) + 1;
        } else {
          act = 1;
        }
      }
  
      let max = Math.floor(this.trendNames.length / TRENDEDITMAXELEMENTS) + 1;
    
      if (act < 1) {
        act = max;
      } else if (act > max) {
        act = 1;
      }  
    
      ts = Tags.CreateTagSet([["Trend_EditPageAct", act], ["Trend_EditPageMax", max]]);
    
      let index = (act - 1) * TRENDEDITMAXELEMENTS;
      let containsSelection = false;
      for (let i = 0; i < TRENDEDITMAXELEMENTS; i++) {
        let name = "";
        if (index + i < this.trendNames.length) {
          name = this.trendNames[index + i].text;
    
          if (this.trendNames[index + i].varName == selection) {
            ts.Add([["Trend_EditSelected", i]]);
            containsSelection = true;
          }
        }
        ts.Add([[`Trend_EditNames[${i}]`, name]]);
      }
    
      if (!containsSelection) {
        ts.Add([["Trend_EditSelected", -1]]);
      }
    
      ts.Write();
    } catch (ex) {
      HMIRuntime.Trace(`TrendEdit::ChangePage ${ex.message}`);
    }
  },
 

  /**
   * POPUP_TrendEdit Element in Liste auswählen
   * 
   * @param {number} slot - Auszuwählendes Element in der Liste
   * @returns {void}
   */
  SelectItem: function(slot) {
    if (slot >= 0) {
      let act = Tags("Trend_EditPageAct").Read();
      let index = (act - 1) * TRENDEDITMAXELEMENTS + slot;
    
      UI.DataSet.Add(trendEditUITag, this.trendNames[index].varName);
      UI.DataSet.Add(trendEditUIUnit, this.trendNames[index].unit);
      UI.DataSet.Add(trendEditUIText, this.trendNames[index].text);

      Tags("Trend_EditSelected").Write(slot);
      //Tags("Trend_Edittext_Selected").Write(this.trendNames[index].text);
      //Tags("Trend_EditTagName").Write(this.trendNames[index].varName);
      //Tags("Trend_EditUnit").Write(this.trendNames[index].unit);
    } else {
      UI.DataSet.Add(trendEditUITag, "");
      UI.DataSet.Add(trendEditUIUnit, "");
      UI.DataSet.Add(trendEditUIText, "");
      Tags("Trend_EditSelected").Write(-1);
      //Tags("Trend_Edittext_Selected").Write("");
      //Tags("Trend_EditTagName").Write("");
      //Tags("Trend_EditUnit").Write(-1);
    }
  }
};

export const TrendEditExport = {
  /**
   * POPUP_TrendEdit wird geöffnet
   * 
   * @param {WinCC.Textbox} textid - Referenz auf die Textbox für die ID
   * @returns {void}
   */
  Loaded: function (textid) {
    //Slotnummer in Textbox einfüllen
    textid.Text = UI.DataSet.Exists(trendEditUISlot) ? UI.DataSet(trendEditUISlot) : '';
    HMIRuntime.Tags.SysFct.SetTagValue("PopUpActive", true);
  
    TrendEditInternal.BuildNames();
    TrendEditInternal.ChangePage(true);
  },
  
  /**
   * POPUP_TrendEdit wird geschlossen
   * 
   * @returns {void}
   */
  Unloaded: function() {
    //Variable auf Abbruch setzen
    
    HMIRuntime.Tags.SysFct.SetTagValue("PopUpActive", false);
  },
}


/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Button_SelectItem(slot) {
  TrendEditInternal.SelectItem(slot);
}
export function Button_ChangePage() {  
  TrendEditInternal.ChangePage(false);
}
export function Button_Save() {
  TrendEditInternal.Save();
}
export function Button_Abort() {
  TrendEditInternal.Abort();
}
export function Button_Delete() {
  TrendEditInternal.Delete();
}
