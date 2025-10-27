
const SettingsIntern = {
  /**
   * Bildet die Liste Einstellungen (ja nach Content-Seite)
   * 
   * @param {boolean} inc - Nächste Seite auflisten
   * @param {boolean} dec - Vorherige Seite auflisten
   * @param {number} mode - Zugehörige Content-Seite: -1 = DoNothing, 0 = TempGroup, 1 = TempZone, 2 = Act, 3 = Set, 4 = State, 5 = Users, 6 = EM27 Abzug, 7 = EM27 Säge, 8 = EM27 Corruagtor, 9 = EM27 Kalibriertisch, 10 = IGS, 11 = Schmelzepumpe, 12 = ConPro
   * @param {boolean} forcereset - Zurücksetzen auf Seite 1 erzwingen
   * @returns {void}
   */
  BuildList: function(inc, dec, mode, forcereset) {
  
    if (mode != -1) {
      let maxElements = 10;
      let zeroText = "";
      let reset = false;
    
      let ts = Tags.CreateTagSet([    
        "DB_Unified_Settings_TempGroup.MaxID",           //Maximale Temperaturgruppen
        "DB_Unified_Settings_TempZone.MaxID",            //Maximale Temperaturzonen
        "DB_Unified_Settings_Act.MaxID",                 //Maximale Ist-Werte
        "DB_Unified_Settings_Set.MaxID",                 //Maximale Soll-Werte
        "DB_Unified_Settings_State.MaxID",               //Maximale States
        "DB_Unified_Settings_User.MaxID",                //Maximale Benutzer
        "DB_Unified_Settings_EM27_Puller.MaxID",         //Maximale EM27-Abzüge
        "DB_Unified_Settings_EM27_Saw.MaxID",            //Maximale EM27-Säge
        "DB_Unified_Settings_EM27_Corrugator.MaxID",     //Maximale EM27-Corrugator
        "DB_Unified_Settings_EM27_CalibTable.MaxID",     //Maximale EM27-CalibTable
        "DB_Unified_Settings_IGS.MaxID",                 //Maximale IGS
        "DB_Unified_Settings_MeltPump.MaxID",            //Maximale Schmelzepumpe
        "DB_Unified_Settings_ConPro.MaxID",              //Maximale ConPro
        "Settings_Page_Act",                    //Aktuelle Seite
        "Settings_SelectedId",                  //Ausgewählte ID
        "Settings_ListMode"                     //Listenmodus (wurde evtl. auch übergeben)
      ]);
      ts.Read();
      
      let page = ts[13].Value;
      let selId = ts[14].Value;
      let oldMode = ts[15].Value;
    
      if (forcereset) {
        reset = true;
      }
  
      //Wenn Listenmodus nicht übergeben wurde, dann auslesen, ansonsten prüfen ob er sich geändert hat
      if (mode == null) {
        mode = oldMode;
      } else if (mode != oldMode) {
        reset = true;
      }
    
      let maxId = 0;
      if (mode >= 0 && mode <= 12) {
        maxId = ts[mode].Value; //Anhand von Mode direkt aus Array lesen, siehe oben Zeile 2
      }
  
      let maxPage = Math.ceil(maxId / maxElements);   //Maximale Seitenzahl berechnen
    
      //Wenn die Seite geblättert wurde, Seitenzahl korrigieren
      if (inc === true) {
        page += 1;
      } else if (dec === true) {
        page -= 1;
      }
    
      //Bei einem Reset Seite 1 anwählen, sonst Prüfen ob Seite kleiner 1 oder größer "Max" ist
      if (reset) {
        page = 1;
      } else if (page == 0) {
        if (!inc && !dec) {
          page = 1;
        } else {
          page = maxPage;
        }
      } else if (page > maxPage) {
        page = 1;
      }
    
      //Tags-Sets für Lesen und Schreiben generieren
      let tsRead = Tags.CreateTagSet();
      let tsWrite = Tags.CreateTagSet();  
    
      //Anhand von Mode und Seitenzahl die Bezeichnungen aus der SPS lesen
      for (let i = 0; i < maxElements; i++) {
        let id = ((page - 1) * maxElements) + i + 1;
        if (id <= maxId) {
          switch (mode) {
            case 0:
              tsRead.Add([
                `DB_Unified_HMILists_TempGroup[${id}].Group`,
              ]);
              break;
            case 1:
              tsRead.Add([
                `DB_Unified_HMILists_TempZone[${id}].Group`, 
                `DB_Unified_HMILists_TempZone[${id}].Name`,
                `DB_Unified_HMILists_TempZone[${id}].SubNum`
              ]);
              break;
            case 2:
              tsRead.Add([
                `DB_Unified_HMILists_Act[${id}].Group`, 
                `DB_Unified_HMILists_Act[${id}].Name`,
                `DB_Unified_HMILists_Act[${id}].SubNum`
              ]);
              break;
            case 3:
              tsRead.Add([
                `DB_Unified_HMILists_Set[${id}].Group`, 
                `DB_Unified_HMILists_Set[${id}].Name`,
                `DB_Unified_HMILists_Set[${id}].SubNum`
              ]);
              break;
            case 4:
              tsRead.Add([
                `DB_Unified_HMILists_State[${id}].Group`, 
                `DB_Unified_HMILists_State[${id}].Name`,
                `DB_Unified_HMILists_State[${id}].SubNum`
              ]);
              break;
            case 5:
              tsRead.Add(`DB_User_Users[${id}].Name`);
              break;
            case 10:
              tsRead.Add([
                `DB_Unified_HMILists_IGS[${id}].Group`, 
                `DB_Unified_HMILists_IGS[${id}].Name`
              ]);
              break;
          }
        }
      }
      tsRead.Read();
  
      //Anhand vom mode die Bezeichnungen generieren
      for (let i = 0; i < maxElements; i++) {    
        let id = ((page - 1) * maxElements) + i + 1;
        let grouptext = "";
        let nametext = "";
        let numtext = "";
        let text = "";
        let group = 0;
        let name = 0;
        let num = 0;
    
        if (id <= maxId) {
          switch (mode) {
            case 0:
              group = tsRead[i].Value;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 1:
              group = tsRead[i * 3 + 0].Value;
              name = tsRead[i * 3 + 1].Value;
              num = tsRead[i * 3 + 2].Value;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              nametext = HMIRuntime.Resources.TextLists("@Default.Zones").Item(name).Item(HMIRuntime.Language);
              numtext = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
              break;
            case 2:
              group = tsRead[i * 3 + 0].Value;
              name = tsRead[i * 3 + 1].Value;
              num = tsRead[i * 3 + 2].Value;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              nametext = HMIRuntime.Resources.TextLists("@Default.Indications").Item(name).Item(HMIRuntime.Language);
              numtext = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
              break;
            case 3:
              group = tsRead[i * 3 + 0].Value;
              name = tsRead[i * 3 + 1].Value;
              num = tsRead[i * 3 + 2].Value;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              nametext = HMIRuntime.Resources.TextLists("@Default.Indications").Item(name).Item(HMIRuntime.Language);
              numtext = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
              break;
            case 4:
              group = tsRead[i * 3 + 0].Value;
              name = tsRead[i * 3 + 1].Value;
              num = tsRead[i * 3 + 2].Value;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              nametext = HMIRuntime.Resources.TextLists("@Default.States").Item(name).Item(HMIRuntime.Language);
              numtext = HMIRuntime.Resources.TextLists("@Default.ID").Item(num).Item(HMIRuntime.Language);
              break;
            case 5:
              let username = tsRead[i].Value;
              text = `${id}: ${username}`;
              break;
            case 6:
              group = 50 + id; //Abzug
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 7:
              group = 60 + id; //Säge
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 8:
              group = 130 + id; //Corrugator
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 9:
              group = 70 + id; //Kalibriertisch
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 10:
              group = tsRead[i * 2 + 0].Value + 1;
              name = tsRead[i * 2 + 1].Value + 1;
              grouptext = `IGS ${group}`;
              nametext = name;
              break;
            case 11:
              group = 110 + id;
              grouptext = HMIRuntime.Resources.TextLists("@Default.Groups").Item(group).Item(HMIRuntime.Language);
              break;
            case 12:
              text = `ConPro ${id}`;
              break;
          }
          
          if (group > 0) {
            text += grouptext;
          }
          if (name > 0) {
            text += ` - ${nametext}`;
          }
          if (num > 0) {
            text += ` ${numtext}`;
          }
        
          if (i == 0) {
            zeroText = text;
          }
        }
  
        tsWrite.Add([[`Settings_SlotText[${i}]`, text]]);
      }
    
      //Seitenzahlen und Mode wieder schreiben
      tsWrite.Add([
        ["Settings_Page_Max", maxPage],
        ["Settings_Page_Act", page],
        ["Settings_ListMode", mode]
      ]);  
    
      //Nach Reset wieder Slot 0 / Id 1 auswählen, ansonsten prüfen ob die aktive ID in den Slots enthalten ist
      if (reset) {
        selId = 1;
  
        tsWrite.Add([
          ["Settings_SelectedSlot", 0],
          ["Settings_SelectedId", selId],
          ["Settings_Header", zeroText]
        ]);
    
      } else {
        let slot = selId - 1 - ((page - 1) * maxElements);
        if (slot >= 0 && slot < maxElements ) {
          tsWrite.Add([["Settings_SelectedSlot", slot]]); 
        } else {
          tsWrite.Add([["Settings_SelectedSlot", -1]]); 
        }     
      }
  
      //Aktive ID wieder setzen
      switch (mode) {
        case 0:
          tsWrite.Add([["DB_Unified_Settings_TempGroup.ID", selId]]);
          break;
        case 1:
          tsWrite.Add([["DB_Unified_Settings_TempZone.ID", selId]]);
          break;
        case 2:
          tsWrite.Add([["DB_Unified_Settings_Act.ID", selId]]);
          break;
        case 3:
          tsWrite.Add([["DB_Unified_Settings_Set.ID", selId]]);
          break;
        case 4:
          tsWrite.Add([["DB_Unified_Settings_State.ID", selId]]);
          break;
        case 5:
          tsWrite.Add([["DB_Unified_Settings_User.ID", selId]]);
          break;
        case 6:
          tsWrite.Add([["DB_Unified_Settings_EM27_Puller.ID", selId]]);
          break;
        case 7:
          tsWrite.Add([["DB_Unified_Settings_EM27_Saw.ID", selId]]);
          break;
        case 8:
          tsWrite.Add([["DB_Unified_Settings_EM27_Corrugator.ID", selId]]);
          break;
        case 9:
          tsWrite.Add([["DB_Unified_Settings_EM27_CalibTable.ID", selId]]);
          break;
        case 10:
          tsWrite.Add([["DB_Unified_Settings_IGS.ID", selId]]);
          break;
        case 11:
          tsWrite.Add([["DB_Unified_Settings_MeltPump.ID", selId]]);
          break;
        case 12:
          tsWrite.Add([["DB_Unified_Settings_ConPro.ID", selId]]);
          break;
      }
    
      tsWrite.Write();
  
      HMIRuntime.Trace(`Settings.BuildList - Mode: ${mode}, Reset: ${reset}, ID: ${selId}, Page: ${page} / ${maxPage}, IncDec: ${inc == true}/${dec == true}`);
    } else {
      HMIRuntime.Trace(`Settings.BuildList - Mode: ${mode}`);
    }
  },

  /**
   * Wählt einen Slot in der Liste aus
   * 
   * @param {number} slot - Ausgewählter Slot
   * @returns {void}
   */
  SlotSetId: function(slot) {
    let maxElements = 10;
    let id = 0;
    let text = "";
  
    let ts = Tags.CreateTagSet(["Settings_Page_Act", "Settings_ListMode", `Settings_SlotText[${slot}]`]);
    ts.Read();
    let curPage = ts[0].Value;  
    let mode = ts[1].Value;
    let slottext = ts[2].Value;
  
  
    if (slottext !== "") {
      if (slot >= 0 && slot < maxElements) { 
        id =  (curPage - 1) * maxElements + slot + 1;
        text = Tags(`Settings_SlotText[${slot}]`).Read();
      }
    
      let tsWrite = Tags.CreateTagSet([    
        ["Settings_Header", text],
        ["Settings_SelectedSlot", slot],
        ["Settings_SelectedId", id]
      ]);
    
      switch (mode) {
        case 0:
          tsWrite.Add([["DB_Unified_Settings_TempGroup.ID", id]]);
          break;
        case 1:
          tsWrite.Add([["DB_Unified_Settings_TempZone.ID", id]]);
          break;
        case 2:
          tsWrite.Add([["DB_Unified_Settings_Act.ID", id]]);
          break;
        case 3:
          tsWrite.Add([["DB_Unified_Settings_Set.ID", id]]);
          break;
        case 4:
          tsWrite.Add([["DB_Unified_Settings_State.ID", id]]);
          break;
        case 5:
          tsWrite.Add([["DB_Unified_Settings_User.ID", id]]);
          break;
        case 6:
          tsWrite.Add([["DB_Unified_Settings_EM27_Puller.ID", id]]);
          break;
        case 7:
          tsWrite.Add([["DB_Unified_Settings_EM27_Saw.ID", id]]);
          break;
        case 8:
          tsWrite.Add([["DB_Unified_Settings_EM27_Corrugator.ID", id]]);
          break;
        case 9:
          tsWrite.Add([["DB_Unified_Settings_EM27_CalibTable.ID", id]]);
          break;
        case 10:
          tsWrite.Add([["DB_Unified_Settings_IGS.ID", id]]);
          break;
        case 11:
          tsWrite.Add([["DB_Unified_Settings_MeltPump.ID", id]]);
          break;
        case 12:
          tsWrite.Add([["DB_Unified_Settings_ConPro.ID", id]]);
      }
    
      tsWrite.Write();
    
      HMIRuntime.Trace(`Settings.SlotSetId - Mode: ${mode}, Slot: ${slot}, ID: ${id}, Text: ${text}`);
    }
  },

  /**
   * Variable für Settings-Page zurücksetzen
   * 
   * @param {boolean} resetMode - Gibt an, ob der Listenmodus auch zurückgesetzt werden soll
   * @returns {void}
   */
  ResetSettings: function(resetMode) {
    let ts = Tags.CreateTagSet([
      ["DB_Unified_Settings_TempGroup.ID", 0],
      ["DB_Unified_Settings_TempZone.ID", 0],
      ["DB_Unified_Settings_Act.ID", 0],
      ["DB_Unified_Settings_Set.ID", 0],
      ["DB_Unified_Settings_State.ID", 0],
      ["DB_Unified_Settings_User.ID", 0],
      ["DB_Unified_Settings_EM27_Puller.ID", 0],
      ["DB_Unified_Settings_EM27_Saw.ID", 0],
      ["DB_Unified_Settings_EM27_Corrugator.ID", 0],
      ["DB_Unified_Settings_EM27_CalibTable.ID", 0],
      ["DB_Unified_Settings_IGS.ID", 0],
      ["DB_Unified_Settings_MeltPump.ID", 0],
      ["DB_Unified_Settings_ConPro.ID", 0],
    ]);
  
    if (resetMode) {
      ts.Add([["Settings_ListMode", -1]]);
    }
  
    ts.Write();
  
    HMIRuntime.Trace(`Settings.ResetSettings - ResetMode: ${resetMode == true}`);
  }
}

export const SettingsExport = {
  /**
   * Erzeugt ein Ausgabeformat mit Dezimalstellen und Einheit
   * 
   * @param {WinCC.TagSet} ts - Tagset, welches in Position 0 die Dezimalstelle und in 1 den Einheitindex enthält
   * @returns {void}
   */
  Dyn_OutputFormat: function(ts) {
    ts.Read();

    let dec = ts[0].Value;
    let unit = ts[1].Value;

    let unittext = "";
  
    if (unit >= 0) {
      unittext = HMIRuntime.Resources.TextLists("@Default.Units").Item(unit).Item(HMIRuntime.Language);
    }
  
    if (dec == 0) {
        if (unittext === "") {
          return "{I}";
        } else {
          return `{I} ${unittext}`;
        }
      } else {
        if (unittext === "") {
          return `{F${dec}}`;
        } else {
          return `{F${dec}} ${unittext}`;
        }
      }
  },

  /**
   * Gibt den Act-Istwert mit Dezimalstellen und Einheit zurück
   * 
   * @param {int} historic - 0/undefined = ActValue, 1 = Historic 1, 2 = Historic 2
   * @returns {void}
   */
  Dyn_ActActualValue: function(historic) {
    let ts = Tags.CreateTagSet(["DB_Unified_Settings_Act.Ret.Dec", "DB_Unified_Settings_Act.Ret.Unit"]);

    if (historic == 1) {
      ts.Add("DB_Unified_Settings_Act.Counter.Value[1]");
    } else if (historic == 2) {
      ts.Add("DB_Unified_Settings_Act.Counter.Value[2]");
    } else {
      ts.Add("DB_Unified_Settings_Act.ActValue");
    }
    ts.Read();
  
    
    let dec = ts[0].Value;
    let unit = ts[1].Value;
    let value = ts[2].Value;
    let unittext = HMIRuntime.Resources.TextLists("@Default.Units").Item(unit).Item(HMIRuntime.Language);
    return `${value.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: dec, maximumFractionDigits: dec })} ${unittext}`;
  },

  /**
   * Gibt den Act-Extern-Wert zurück
   * 
   * @returns {void}
   */
  Dyn_ActExternalValue: function() {
    let extern = Tags("DB_Unified_Settings_Act.ExternValue").Read();
    return extern.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  /**
   * Gibt den Act-Extern-Wert als Spannung zurück
   * 
   * @returns {void}
   */
  Dyn_ActExternalVoltage: function() {
    let extern = Tags("DB_Unified_Settings_Act.ExternValue").Read();
    let voltage = extern / 2764.8;
    return `${voltage.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} V`;
  },

  /**
   * Gibt den Set-Istwert mit Dezimalstellen und Einheit zurück
   * 
   * @returns {void}
   */
  Dyn_SetActualValue: function() {
    let ts = Tags.CreateTagSet(["DB_Unified_Settings_Set.ActValue", "DB_Unified_Settings_Set.Ret.Dec", "DB_Unified_Settings_Set.Ret.Unit"]);
    ts.Read();
  
    let value = ts[0].Value;
    let dec = ts[1].Value;
    let unit = ts[2].Value;
    let unittext = HMIRuntime.Resources.TextLists("@Default.Units").Item(unit).Item(HMIRuntime.Language);
    return `${value.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: dec, maximumFractionDigits: dec })} ${unittext}`;
  },

  /**
   * Gibt den Set-Extern-Wert zurück
   * 
   * @returns {void}
   */
  Dyn_SetExternalValue: function() {
    let extern = Tags("DB_Unified_Settings_Set.ExternValue").Read();
    return extern.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  },

  /**
   * Gibt den Set-Extern-Wert als Spannung zurück
   * 
   * @returns {void}
   */
  Dyn_SetExternalVoltage: function() {
    let extern = Tags("DB_Unified_Settings_Set.ExternValue").Read();
    let voltage = extern / 2764.8;
    return `${voltage.toLocaleString(HMIRuntime.Resources.TextLists("@Default.LanguageCodes").Item(0).Item(HMIRuntime.Language), { minimumFractionDigits: 3, maximumFractionDigits: 3 })} V`;
  },

  /**
   * Gibt den State-Original-Wert zurück
   * 
   * @returns {void}
   */
  Dyn_StateOriginalValue: function() {
    let ts = Tags.CreateTagSet(["DB_Unified_Settings_State.State", "DB_Unified_Settings_State.Ret.Invers"]);
    ts.Read();
    
    let state = ts[0].Value;
    let invers = ts[1].Value;
    let list = 0;
  
    if (state ^ invers) {
      list = 1;
    }
  
    return HMIRuntime.Resources.TextLists("@Default.OnOff").Item(list).Item(HMIRuntime.Language);
  },
}
/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Event_Loaded(mode) {
  SettingsIntern.BuildList(undefined, undefined, mode, undefined);
}
export function Button_SlotSetId(slot) {
  SettingsIntern.SlotSetId(slot);
}
export function Event_Unloaded(resetMode) {
  SettingsIntern.ResetSettings(resetMode);
}
export function Button_LanguageChanged(mode, forcereset) {
  SettingsIntern.BuildList(undefined, undefined, mode, forcereset);
}
export function Event_StartLoaded() {
  SettingsIntern.ResetSettings(true);
}
export function Button_List_Left() {
  SettingsIntern.BuildList(undefined, true, undefined, undefined);
}
export function Button_List_Right() {
  SettingsIntern.BuildList(true, undefined, undefined, undefined);
}
export function Button_Submit() {
  HMIRuntime.Tags.SysFct.SetTagValue("DB_Unified_Settings_Submit", true);
  HMIRuntime.Timers.SetTimeout(() => SettingsIntern.BuildList(undefined, undefined, undefined, undefined), 1000);
}
