import { textsPath, textsUsbPath } from "_PATH";

const LDIAG_intern = {
  /**
   * Gibt an, ob die Konfiguration initialisiert wrude
   *
   * @type {boolean}
   */
  init: false,

  /**
  * Diagnose Statustext
  *
  * @type {string}
  */
  diagnosis_statustext: "",

  /**
  * Diagnose Hilfetext
  *
  * @type {string}
  */
  diagnosis_helptext: "",

  /**
  * Diagnose Gerätealarmtext
  *
  * @type {string}
  */
  diagnosis_devicealarmtext: "",

  /**
  /* Kopiert den Inhalt der Texdateien ins Ziel
  * @returns {void}
  */
  UpdateTexts: function () {
    const indexFile = '/media/simatic/X61/texts/index.txt';
    const srcFolder  = '/media/simatic/X61/texts/';
    const dstFolder  = textsPath;

    HMIRuntime.FileSystem.ReadFile(indexFile, "utf8")
        .then(function(indexContent) {
            let fileNames = indexContent.split(/\r?\n/).filter(name => name.trim() !== "");
            fileNames.forEach(function(fileName) {
                let src = srcFolder + fileName;
                let dst = dstFolder + fileName;
                HMIRuntime.FileSystem.ReadFile(src, "utf8")
                    .then(content => HMIRuntime.FileSystem.WriteFile(dst, content, "utf8"))
                    .then(() => {
                        HMIRuntime.Trace(`Kopiert: ${fileName}`);
                    })
                    .catch(err => handleError(err, src));
            });
        })
        .catch(err => handleError(err, indexFile));

    function handleError(errCode, path) {
        let description = HMIRuntime.GetDetailedErrorDescription(errCode);
        HMIRuntime.Trace(`Error ${errCode} beim Zugriff auf "${path}": ${description}`);}
  },


  /**
  * Setzt die HMI Variablen zurück
  *
  * @returns {void}
  */
  ResetDiagnosistexts: function () {
  
    // Texte löschen
    Tags("Diagnosis_deviceAlarmtext").Write("");
    Tags("Diagnosis_helptext").Write("");
    Tags("Diagnosis_statustext").Write("");
  
  },

  /**
  * Setzt cmd Close an PLC
  *
  * @returns {void}
  */
  CmdClosePopUp: function () {
  
    // Trace
    HMIRuntime.Trace("LDIAG::CmdClosePopUp: PopUp schließen");

    // PopUp schließen
    Tags("InstLDIAG_ModuleDiagnosis_extPopUpInterface.cmdClose").Write(1);

  },

  /**
  * Liest die Datei und sucht nach einem Eintrag mit einer bestimmten ID.
  * @param {string} file Dateiname, z.B. "Diagnosis.txt"
  * @param {number} id Die gesuchte ID, z.B. 45068
  * @param {string} resultTag Zieltag für den Text
  * @returns {Promise<string>} Promise mit dem gefundenen Text oder Fehler
  */
  GetTextEntry: function (file, id, info, resultTag) {

    let foundText = "";
    //let diagnosisId = Tags("Diagnosis_Id").Read();

    HMIRuntime.FileSystem.ReadFile(file, 'utf8')
      .then(
        function (data) {
          HMIRuntime.Trace('LDIAG::GetTextEntry::Datei gelesen');

          return data;
        })
      // 2. Dateiinhalt parsen und suchen
      .then(function (content) {
        let lines = content.split(/\r?\n/);
        let searchId = id.toString();
        let resultText = searchId + " not found";
        HMIRuntime.Trace(`LDIAG::GetTextEntry: ${file} - suche nach: ${searchId}`);
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          // Header/Kommentare überspringen
          if (line === "" || line.startsWith("#")) {
            continue;
          }
          // Treffer, wenn Zeile mit "ID;" beginnt
          if (line.indexOf(searchId + ";") === 0) {
            let parts = line.split(";");
            if (parts.length > 1) {
              id = parts[0].trim();
              resultText = parts[1].trim();
            }
            break;
          }
        }
        return resultText;
      })
      // 3. Ergebnis in Tags schreiben
      .then(function (resultText) {
        HMIRuntime.Trace("LDIAG::GetTextEntry:Suche beendet: ID=" + id + " " + resultText);
        Tags(resultTag).Write(info + " " + resultText);
      })
      .catch(function (errorCode) {
        HMIRuntime.Trace('LDIAG::GetTextEntry:Read failed errorcode=' + errorCode);
        Tags(resultTag).Write(`Fehler: ${errorCode}`);
      });


  },

  /**
  * Liest die Datei und sucht nach einem Eintrag mit einer bestimmten ID.
  * @returns {void} 
  */
  GetDevicealarmText: function () {
    HMIRuntime.Trace(`LDIAG::GetDevicealarmText:`);

    try {

      let id = Tags("InstLDIAG_ModuleDiagnosis_extPopUpModule.diagnosis.subFuncStatus").Read();
      if (id > 0) {
        HMIRuntime.Trace(`LDIAG::GetDevicealarmText: id= ${id}`);
        let foundText = "";
        let language = Tags("LanguageSuffix").Read();
        let languageFile = "_" + language.toString() + ".txt";
        
        let file = Tags("InstLDIAG_ModuleDiagnosis_extPopUpModule.config.textlistDevice").Read();
        let filePath = textsPath + file + languageFile;
        let info = file.toString() + " Errorcode " + id.toString() + " ";
        // Statustext
        LDIAG_intern.GetTextEntry(filePath, id, info, "Diagnosis_deviceAlarmtext");
      }

    }
    catch (ex) {
      HMIRuntime.Trace('LDIAG::GetDiagnosisText:' + ex);
    };
  },

  /**
  * Liest die Datei und sucht nach einem Eintrag mit einer bestimmten ID.
  * @returns {void} 
  */
  GetDiagnosisText: function () {
    HMIRuntime.Trace(`LDIAG::GetDiagnosisText:`);

    try {
      let foundText = "";
      let file = "Diagnosis";
      let language = Tags("LanguageSuffix").Read();
      let languageFile = "_" + language.toString() + ".txt";
      let id = Tags("InstLDIAG_ModuleDiagnosis_extPopUpModule.diagnosis.status").Read();
      let searchId = "16#" + id.toString(16).toUpperCase();
      let filePath = textsPath + file + languageFile;
      //let diagnosisId = Tags("Diagnosis_Id").Read();

      // Statustext
      LDIAG_intern.GetTextEntry(filePath, searchId, "", "Diagnosis_statustext");

      // Hilfetext
      file = "Help";
      filePath = textsPath + file + languageFile;
      LDIAG_intern.GetTextEntry(filePath, searchId, "", "Diagnosis_helptext");

    }
    catch (ex) {
      HMIRuntime.Trace('LDIAG::GetDiagnosisText:' + ex);
    };

  }
}


/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Event_ClosePopUpDiagnosis() {
  // Texte löschen
  LDIAG_intern.ResetDiagnosistexts();
  // Befehl schließen
  LDIAG_intern.CmdClosePopUp();
}
export function Event_ClosePopUpRembergAi() {

}
export function Event_ShowPopUpDiagnosis() {

    HMIRuntime.UI.SysFct.ChangeScreen("POPUP_Diagnosis", "~/PopUp_Diagnosis");
    LDIAG_intern.GetDiagnosisText();
    LDIAG_intern.GetDevicealarmText();
}
export function Event_ShowPopUpRembergAi() {
  HMIRuntime.UI.SysFct.ChangeScreen("POPUP_RembergAi", "~/PopUp_Diagnosis");
}
export function Event_UpdateTexts() {
  LDIAG_intern.UpdateTexts();
}
