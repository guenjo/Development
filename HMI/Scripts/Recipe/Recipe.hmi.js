import {recipePath, valueFile, recipeFile} from "_PATH"

/**
 * Trennzeichen im CSV file (American: , European: ;)
 *
 * @type {string}
 */
const delimiter = ';';

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Produktname
 *
 * @type {string}
 */
const dsProduct = 'dsProduct';

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Variantenname
 *
 * @type {string}
 */
const dsVariant = 'dsVariant';

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Produktbeschreibung
 *
 * @type {string}
 */
const dsDescription = 'dsDescription';

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Info-Panel-Inhalt
 *
 * @type {string}
 */
const dsContent = 'dsContent';

/**
 * Tagname für "HMIRuntime.UI.DataSet"
 * Inhalt: Popup wurde geschlossen
 *
 * @type {string}
 */
const dsDone = 'dsDone';

/**
 * Diese Werte werden im "einfachen" Info-Panel angezeigt
 *
 * @type {Array<string>}
 */
const simpleValues = ['RecipeSP1', 'RecipeValue'];

/**
 * Klasse für eine das Model eines Rezeptes
 *
 * @class
 */
 class ModelRecipe {
  /**
   * @param {number} recipeId - Rezeptnummer
   * @param {string} productName - Produktname im Rezept
   * @param {string} variantName - Variante des Produktes im Rezept
   * @param {string} descriptionText - Beschreibung des Rezeptes
   */
  constructor(recipeId, productName, variantName, descriptionText) {
    this.recipeId = recipeId;
    this.productName = productName;
    this.variantName = variantName;
    this.descriptionText = descriptionText;
    this.lastSaved = '---';
  }

  /**
   * Gibt die Rezepturbezeichung für das Rezepturfeld in der HMI zurück
   * 
   * @returns {string} - Rezepturbezeichung
   */
  getName() {
    return `${this.recipeId} / ${this.productName} / ${this.variantName}`;
  }

  /**
   * Serialisiert das Rezept in einen CSV-String
   * 
   * @returns {string} - CSV-String
   */
  serialize() {
    return [this.recipeId, this.productName, this.variantName, this.descriptionText, this.lastSaved]
      .map(x => (x !== undefined) ? x.toString().replace(delimiter, ',') : '')  
      .join(delimiter);
  }

  /**
   * Deserialisiert das Rezept aus einem CSV-String
   * 
   * @param {string} content - CSV-String
   * @returns {boolean} - Gibt zurück, ob das Rezept gültig ist
   */
  deserialize(content){
    let columns = content.split(delimiter);
    this.recipeId = parseInt(columns[0]);
    this.productName = columns[1];
    this.variantName = columns[2];
    this.descriptionText = columns[3];
    this.lastSaved = columns[4];
    return !isNaN(this.recipeId); //valid
  }
}

/**
 * Klasse für eine das Model eines HMI-Tags
 * Erzeugt den Zusammenhang des B64 Werte zu den einzelnen PLC-Variablen
 *
 * @class
 */
  class ModelTag {
  /**
   * @param {string} tagName - Name der HMI-Tags
   * @param {string} plcRID - RecipeID der zugehörigen PLC-Datentyps
   * @param {Array<PLCValue>} plcValues - alle zugehörigen PLC-Variablen
   */
  constructor(tagName, plcRID, plcValues) {
    this.tagName = tagName;
    this.plcRID = plcRID;
    this.b64 = '';
    this.plcValues = plcValues;
  }

  /**
   * Erzeugt aus den PLC-Variablen ein Byte-Array und daraus den Base64-Codierten String
   * 
   * @returns {void}
   */
  encode() {
    let byteArray = [];
    let multibool = 0;
    for (const plcValue of this.plcValues) {
      plcValue.valueToBytes();
      
      if (byteArray.length % 2 == 1 && plcValue.plcVariable.dataType.size > 1) {
        //Füllbytes hinzufügen
        byteArray.push(0);
      } else if (plcValue.plcVariable.dataType.type == 'BOOL') {
        //Mehrere Bool-Werte in einem Byte prüfen
        if (multibool > 7) {
          multibool = 0;
        }
      }

      if (plcValue.plcVariable.dataType.type == 'BOOL') {
        if (multibool > 0) {
          if (plcValue.value > 0) {
            byteArray[byteArray.length - 1] = byteArray[byteArray.length - 1] | Math.pow(2, multibool);
          }
        } else {
          byteArray.push(plcValue.bytes[0])
        }
        multibool += 1;
      } else {
        multibool = 0;
        for (const value of plcValue.bytes) {        
          byteArray.push(value)
        }
      }
    }

    if (byteArray.length % 2 == 1) {
      //Auf gerade Bytezahl ergänzen
      byteArray.push(0);
    }

    this.b64 = Base64.bytesToBase64(byteArray);
  }

  /**
   * Erzeugt aus dem Base64-Codierten String ein Byte-Array und bilded dann die Werte für die PLC-Variablen
   * 
   * @returns {void}
   */
  decode() { 
    try {      
      let bytes = Base64.base64ToBytes(this.b64);
      let curbyte = 0;
      let multibool = 0;
      for (const plcValue of this.plcValues) {
        if (curbyte % 2 == 1 && plcValue.plcVariable.dataType.size > 1) {
          //Füllbytes korrigieren
          curbyte += 1;
        } else if (plcValue.plcVariable.dataType.type == 'BOOL') {
          //Mehrere Bool-Werte in einem Byte prüfen
          if (multibool > 7) {
            multibool = 0;
          } else if (multibool > 0) {
            curbyte -= 1;
          }
        }      
  
        if (plcValue.plcVariable.dataType.type == 'BOOL') {
          //Wenn Bool-Werte dann Bit in Byte bestimmen
          plcValue.bytes = [(bytes[curbyte] & Math.pow(2, multibool)) > 0];
          multibool += 1;
        } else {
          plcValue.bytes = bytes.slice(curbyte, curbyte + plcValue.plcVariable.dataType.size);
          multibool = 0;
        }
        curbyte += plcValue.plcVariable.dataType.size;
        plcValue.bytesToValue();
        //HMIRuntime.Trace(plcValue.plcVariable.name + ": " + plcValue.value);
      }
    } catch (error) {
      HMIRuntime.Trace(this.tagName + ' ERROR: ' + error.message);
    }
  }
}

/**
 * Klasse für das Model eine PLC-Wertes, zugehörig zu einem Rezept 
 *
 * @class
 */
class ModelValue {
  /**
   * @param {number} recipeId - Rezeptnummer
   * @param {string} plcRID - RID des Wertes
   * @param {string} plcVariableName - Variablenname der PLC-Variable
   * @param {string} plcValueString - Wert als String
   */
  constructor(recipeId, plcRID, plcVariableName, plcValueString) {
    this.recipeId = recipeId;
    this.plcRID = plcRID;
    this.plcVariableName = plcVariableName;
    this.plcValueString = plcValueString;
  }

  /**
   * Serialisiert den PLC-Wert in einen CSV-String
   * 
   * @returns {string} - CSV-String
   */
  serialize() {
    return [this.recipeId, this.plcRID, this.plcVariableName, this.plcValueString]
      .join(delimiter);
  }

  /**
   * Deserialisiert den PLC-Wert aus einem CSV-String
   * 
   * @param {string} content - CSV-String
   * @returns {boolean} - Gibt zurück, ob der PLC-Wert gültig ist
   */
  deserialize(content){
    let columns = content.split(delimiter);
    this.recipeId = parseInt(columns[0]);
    this.plcRID = columns[1];
    this.plcVariableName = columns[2];
    this.plcValueString = columns[3];
    return !isNaN(this.recipeId); //valid
  }
}


/**
 * Klasse für den Datentyp einer Rezeptvariablen
 *
 * @class
 */
class PLCDataType {
  /**
   * @param {string} type - Datentyp der PLC-Variablen
   * @param {number} size - Anzahl der Bytes, die die Variable im Speicher einnimmt
   */
  constructor(type, size) {
    this.type = type;
    this.size = size;
  }
}

/**
 * Klasse für einen Wert aus der PLC
 *
 * @class
 */
class PLCValue {
  /**
   * @param {PLCVariable} plcVariable - Zugehörige PLCVariable zum Wert
   */
  constructor(plcVariable) {
    this.plcVariable = plcVariable;
    this.bytes = [];
    this.value = 0;
  }

  /**
   * Liest den Wert als String ein und konvertiert ihn in Abhängigkeit des Datentyps
   * 
   * @param {string} str - Wert als String
   * @returns {void}
   */
  valueFromString(str) {
    switch(this.plcVariable.dataType.type) {
      case 'BOOL':
        this.value = (str == 'true') || (str == 'True')
        break;
      case 'USINT':
      case 'UINT':
      case 'INT':
      case 'UDINT':
      case 'DINT':      
      case 'TOD':
        this.value = parseInt(str);
        break;      
      case 'REAL':
        this.value = parseFloat(str);
        break;
      default:        
        break;
    }
  }

  /**
   * Konvertiert den zugehörigen Wert in das Byte-Array
   * 
   * @returns {void}
   */
  valueToBytes() {
    let buf = new ArrayBuffer(this.plcVariable.dataType.size);
    let view = new DataView(buf);

    switch(this.plcVariable.dataType.type) {
      case 'BOOL':
        view.setUint8(0, this.value);
        break;
      case 'USINT':
        view.setUint8(0, this.value);
        break;
      case 'UINT':
        view.setUint16(0, this.value);
        break;
      case 'INT':
        view.setInt16(0, this.value);
        break;
      case 'UDINT':
        view.setUint32(0, this.value);
        break;
      case 'DINT':
        view.setInt32(0, this.value);
        break;
      case 'REAL':
        view.setFloat32(0, this.value);
        break;
      case 'TOD':
        view.setUint32(0, this.value);
        break;
      default:        
        break;
    }

    this.bytes = new Uint8Array(buf);
  }

  /**
   * Konvertiert das Byte-Array in den zugehörigen Wert
   * 
   * @returns {void}
   */
  bytesToValue() {    
    let buf = new ArrayBuffer(this.bytes.length);
    let view = new DataView(buf);
    
    // set bytes
    this.bytes.forEach((b, i) => {
        view.setUint8(i, b);
    });

    switch(this.plcVariable.dataType.type) {
      case 'BOOL':
        this.value = view.getUint8(0) > 0;
        break;
      case 'USINT':
        this.value = view.getUint8(0);
        break;
      case 'UINT':
        this.value = view.getUint16(0);
        break;
      case 'INT':
        this.value = view.getInt16(0);
        break;
      case 'UDINT':
        this.value = view.getUint32(0);
        break;
      case 'DINT':
        this.value = view.getInt32(0);
        break;
      case 'REAL':
        this.value = Math.round(view.getFloat32(0) * 1000) / 1000;
        break;
      case 'TOD':
        this.value = view.getUint32(0);
        break;
      default:
        this.value = 0;
        break;
    }
  }
}

/**
 * Klasse für eine PLC-Variablen
 *
 * @class
 */
  class PLCVariable {
  /**
   * @param {string} name - Name der PLC-Variablen
   * @param {string} dataType - Datentyp der PLC-Variablen
   * @param {boolean} simple - Angabe ob die Variable für die "einfache" Rezepturanzeige relevant ist
   */
  constructor(name, dataType, simple = false) {
    this.name = name;
    this.dataType = dataType;
    this.simple = simple;
  }
}


/**
 * Mögliche PLC-Datentypen
 *
 * @type {Object}}
 */
const dataTypes = {
  BOOL: new PLCDataType('BOOL', 1),
  USINT: new PLCDataType('USINT', 1),
  UINT: new PLCDataType('UINT', 2),
  INT: new PLCDataType('INT', 2),
  UDINT: new PLCDataType('UDINT', 4),
  DINT: new PLCDataType('DINT', 4),
  REAL: new PLCDataType('REAL', 4),
  TOD: new PLCDataType('TOD', 4),
}

const RecipeVariableTypes = { 
  type_LINE_TempZone_Para: [
    new PLCVariable('Group', dataTypes.USINT),
    new PLCVariable('Name', dataTypes.USINT),
    new PLCVariable('SubNum', dataTypes.UINT),
    new PLCVariable('Unit', dataTypes.USINT),
    new PLCVariable('Dec', dataTypes.USINT),
    new PLCVariable('Enabled', dataTypes.BOOL),
    new PLCVariable('RecipeSP1', dataTypes.REAL, true),
    new PLCVariable('RecipeSP2', dataTypes.REAL, true),
    new PLCVariable('HeatingEnabled', dataTypes.BOOL),
    new PLCVariable('CoolingEnabled', dataTypes.BOOL),
    new PLCVariable('OperatingMode', dataTypes.USINT),
    new PLCVariable('HeatCurrentController', dataTypes.USINT),
    new PLCVariable('MaxCoolingPower', dataTypes.REAL),
    new PLCVariable('LBOn', dataTypes.BOOL),
    new PLCVariable('LBTime', dataTypes.UDINT),
    new PLCVariable('CurrSP', dataTypes.REAL),
    new PLCVariable('MinSP', dataTypes.REAL),
    new PLCVariable('MaxSP', dataTypes.REAL),
    new PLCVariable('Limit_Hysterese', dataTypes.REAL),
    new PLCVariable('Limit_LA', dataTypes.REAL),
    new PLCVariable('Limit_DL', dataTypes.REAL),
    new PLCVariable('Limit_DH', dataTypes.REAL),
    new PLCVariable('Limit_HA', dataTypes.REAL),
    new PLCVariable('dynGeneral', dataTypes.REAL),
    new PLCVariable('XPH', dataTypes.REAL),
    new PLCVariable('XPC', dataTypes.REAL),
    new PLCVariable('TNH', dataTypes.REAL),
    new PLCVariable('TNC', dataTypes.REAL),
    new PLCVariable('TVH', dataTypes.REAL),
    new PLCVariable('TVC', dataTypes.REAL),
    new PLCVariable('TABH', dataTypes.REAL),
    new PLCVariable('TABC', dataTypes.REAL),
    new PLCVariable('StartLockTemp', dataTypes.REAL),
    new PLCVariable('GentleStartup', dataTypes.BOOL)
  ],

  type_LINE_TempGroup_Para: [
    new PLCVariable('HeatThroughTime', dataTypes.UDINT),
    new PLCVariable('TimerOnTime[0]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[1]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[2]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[3]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[4]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[5]', dataTypes.TOD),
    new PLCVariable('TimerOnTime[6]', dataTypes.TOD)
  ],

  type_LINE_Act_Para: [
    new PLCVariable('Group', dataTypes.USINT),
    new PLCVariable('Name', dataTypes.USINT),
    new PLCVariable('SubNum', dataTypes.UINT),
    new PLCVariable('Unit', dataTypes.USINT),
    new PLCVariable('Dec', dataTypes.USINT),
    new PLCVariable('LineLoweringValue', dataTypes.REAL),
    new PLCVariable('EnableAbsoluteAlarms', dataTypes.BOOL),
    new PLCVariable('EnableDeviationAlarms', dataTypes.BOOL),
    new PLCVariable('Limit_Hysterese', dataTypes.REAL),
    new PLCVariable('Limit_LLA', dataTypes.REAL),  
    new PLCVariable('Limit_LA', dataTypes.REAL),
    new PLCVariable('Limit_DL', dataTypes.REAL),
    new PLCVariable('Limit_DH', dataTypes.REAL),
    new PLCVariable('Limit_HA', dataTypes.REAL),
    new PLCVariable('Limit_HHA', dataTypes.REAL),
    new PLCVariable('Filter_Factor', dataTypes.REAL),
    new PLCVariable('ScalCustom', dataTypes.BOOL),
    new PLCVariable('ScalExtern1', dataTypes.REAL),
    new PLCVariable('ScalPLC1', dataTypes.REAL),
    new PLCVariable('ScalExtern2', dataTypes.REAL),
    new PLCVariable('ScalPLC2', dataTypes.REAL),
    new PLCVariable('ZeroCatch', dataTypes.REAL),
    new PLCVariable('SBreakValue', dataTypes.REAL),
    new PLCVariable('CounterResetMode', dataTypes.USINT)
  ],

  type_LINE_Set_Para: [
    new PLCVariable('Group', dataTypes.USINT),
    new PLCVariable('Name', dataTypes.USINT),
    new PLCVariable('SubNum', dataTypes.UINT),
    new PLCVariable('Unit', dataTypes.USINT),
    new PLCVariable('Dec', dataTypes.USINT),
    new PLCVariable('RampUpTime', dataTypes.UINT),
    new PLCVariable('LineLowerPrc', dataTypes.USINT),
    new PLCVariable('SynchronMode', dataTypes.USINT),
    new PLCVariable('KeepSetValueWhenOff', dataTypes.BOOL),
    new PLCVariable('RampingPossible', dataTypes.BOOL),
    new PLCVariable('ScalCustom', dataTypes.BOOL),
    new PLCVariable('RangeEnabled', dataTypes.BOOL),
    new PLCVariable('RangeMaxValue', dataTypes.REAL),
    new PLCVariable('RangeMinValue', dataTypes.REAL),  
    new PLCVariable('Ramp[0].Delay', dataTypes.UDINT),
    new PLCVariable('Ramp[0].Setpoint', dataTypes.REAL),
    new PLCVariable('Ramp[0].StartupTime', dataTypes.UDINT),
    new PLCVariable('Ramp[1].Delay', dataTypes.UDINT),
    new PLCVariable('Ramp[1].Setpoint', dataTypes.REAL),
    new PLCVariable('Ramp[1].StartupTime', dataTypes.UDINT),
    new PLCVariable('Ramp[2].Delay', dataTypes.UDINT),
    new PLCVariable('Ramp[2].Setpoint', dataTypes.REAL),
    new PLCVariable('Ramp[2].StartupTime', dataTypes.UDINT),
    new PLCVariable('ResetValue', dataTypes.REAL),
    new PLCVariable('ResetTime', dataTypes.UDINT),
    new PLCVariable('Step', dataTypes.REAL),    
    new PLCVariable('ScalExtern1', dataTypes.REAL),
    new PLCVariable('ScalPLC1', dataTypes.REAL),
    new PLCVariable('ScalExtern2', dataTypes.REAL),
    new PLCVariable('ScalPLC2', dataTypes.REAL),
    new PLCVariable('RecipeValue', dataTypes.REAL, true)
  ],

  type_LINE_State_Para: [
    new PLCVariable('Group', dataTypes.USINT),
    new PLCVariable('Name', dataTypes.USINT),
    new PLCVariable('SubNum', dataTypes.UINT),
    new PLCVariable('AlarmMode', dataTypes.USINT),
    new PLCVariable('Delay', dataTypes.INT),
    new PLCVariable('EnableHMIInverse', dataTypes.BOOL),
    new PLCVariable('Invers', dataTypes.BOOL)
  ],

  type_LINE_SawControl_Para: [
    new PLCVariable('Profiling.NumberOfNeededProfiles[0]', dataTypes.UINT),
    new PLCVariable('Profiling.NumberOfNeededProfiles[1]', dataTypes.UINT),
    new PLCVariable('Profiling.NumberOfNeededProfiles[2]', dataTypes.UINT),
    new PLCVariable('Profiling.NumberOfNeededProfiles[3]', dataTypes.UINT),
    new PLCVariable('Profiling.NumberOfNeededProfiles[4]', dataTypes.UINT),
    new PLCVariable('Profiling.NumberOfNeededProfiles[5]', dataTypes.UINT),
    new PLCVariable('Profiling.ProfilLength[0]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilLength[1]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilLength[2]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilLength[3]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilLength[4]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilLength[5]', dataTypes.UDINT),
    new PLCVariable('Profiling.ProfilOffset[0]', dataTypes.DINT),
    new PLCVariable('Profiling.ProfilOffset[1]', dataTypes.DINT),
    new PLCVariable('Profiling.ProfilOffset[2]', dataTypes.DINT),
    new PLCVariable('Profiling.ProfilOffset[3]', dataTypes.DINT),
    new PLCVariable('Profiling.ProfilOffset[4]', dataTypes.DINT),
    new PLCVariable('Profiling.ProfilOffset[5]', dataTypes.DINT),
    new PLCVariable('TippingThrough.PulseDuration', dataTypes.REAL),
    new PLCVariable('TippingThrough.MoveDistance', dataTypes.DINT),
    new PLCVariable('Thickening.Active', dataTypes.BOOL),
    new PLCVariable('Thickening.Position', dataTypes.USINT),
    new PLCVariable('Thickening.Distance', dataTypes.UDINT),
    new PLCVariable('Thickening.Length', dataTypes.UDINT),
    new PLCVariable('Thickening.Percent', dataTypes.REAL),
    new PLCVariable('Thickening.Offset', dataTypes.DINT),
    new PLCVariable('SampleLength', dataTypes.UDINT),
    new PLCVariable('ScalingFactor', dataTypes.DINT),
    new PLCVariable('CuttingPulse', dataTypes.REAL)
  ],

  type_LINE_MeltPumpControl_Para: [
    new PLCVariable('Enabled', dataTypes.BOOL),
    new PLCVariable('XP', dataTypes.REAL),
    new PLCVariable('TN', dataTypes.REAL),
    new PLCVariable('TAB', dataTypes.UDINT),
    new PLCVariable('MinRpmPump', dataTypes.REAL),
    new PLCVariable('TimeShutdown', dataTypes.UDINT),
    new PLCVariable('TimeProduction', dataTypes.UDINT),
    new PLCVariable('TimeStartup', dataTypes.UDINT),
    new PLCVariable('MaxPressureDiff', dataTypes.REAL),
    new PLCVariable('MinPressureDiff', dataTypes.REAL),
    new PLCVariable('MinMPIn', dataTypes.REAL)
  ],

  type_LINE_Meterweight_Para: [
    new PLCVariable('SP', dataTypes.REAL),
    new PLCVariable('XP', dataTypes.REAL),
    new PLCVariable('TN', dataTypes.REAL),
    new PLCVariable('TAB', dataTypes.REAL),
    new PLCVariable('Limit', dataTypes.UINT)
  ],

  type_EM27_Para_CanMaster: [
    new PLCVariable('NodeId', dataTypes.USINT),
    new PLCVariable('HeartBeatTime', dataTypes.UINT),
    new PLCVariable('SyncIntervall', dataTypes.UINT)
  ],

  type_EM27_Para_CanSlave: [
    new PLCVariable('Enabled', dataTypes.BOOL),
    new PLCVariable('AutomaticNodeSearch', dataTypes.BOOL),
    new PLCVariable('NodeId', dataTypes.USINT),
    new PLCVariable('MasterHeartBeatTimeOutTime', dataTypes.UINT),
    new PLCVariable('SlaveHeartBeatTimeOutTime', dataTypes.UINT),
    new PLCVariable('TxPDOTimeOutTime', dataTypes.UINT),
    new PLCVariable('ProducerHeartBeatTime', dataTypes.UINT),
    new PLCVariable('SDOCycleTime', dataTypes.UINT),
    new PLCVariable('SDOPause', dataTypes.UINT)
  ],

  type_EM27_Para_EM27Puller: [
    new PLCVariable('SpeedSetMaximum', dataTypes.UDINT),
    new PLCVariable('ScalingFactor', dataTypes.UDINT),
    new PLCVariable('LoadSetValue', dataTypes.UDINT),
    new PLCVariable('HeightAdj[0]', dataTypes.INT),
    new PLCVariable('HeightAdj[1]', dataTypes.INT),
    new PLCVariable('HeightAdj[2]', dataTypes.INT),
    new PLCVariable('HeightAdj[3]', dataTypes.INT),
    new PLCVariable('HeightAdj[4]', dataTypes.INT),
    new PLCVariable('HeightAdj[5]', dataTypes.INT),
    new PLCVariable('HeightAdj[6]', dataTypes.INT),
    new PLCVariable('HeightAdj[7]', dataTypes.INT),
    new PLCVariable('HeightAdj[8]', dataTypes.INT),
    new PLCVariable('HeightAdj[9]', dataTypes.INT),
    new PLCVariable('PressureSetValue[0]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[1]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[2]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[3]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[4]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[5]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[6]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[7]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[8]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[9]', dataTypes.UINT),
    new PLCVariable('AutoSpeedMax', dataTypes.BOOL)
  ],

  type_EM27_Para_EM27Saw: [
    new PLCVariable('ScalingFactor', dataTypes.UDINT),
    new PLCVariable('EarlyWarningLength', dataTypes.UDINT),
    new PLCVariable('ProductGrooveSetValue', dataTypes.UDINT),
    new PLCVariable('CutDepth', dataTypes.UINT),
    new PLCVariable('HeightAdj[0]', dataTypes.INT),
    new PLCVariable('HeightAdj[1]', dataTypes.INT),
    new PLCVariable('HeightAdj[2]', dataTypes.INT),
    new PLCVariable('HeightAdj[3]', dataTypes.INT),
    new PLCVariable('HeightAdj[4]', dataTypes.INT),
    new PLCVariable('HeightAdj[5]', dataTypes.INT),
    new PLCVariable('HeightAdj[6]', dataTypes.INT),
    new PLCVariable('HeightAdj[7]', dataTypes.INT),
    new PLCVariable('HeightAdj[8]', dataTypes.INT),
    new PLCVariable('HeightAdj[9]', dataTypes.INT)
  ],

  type_EM27_Para_EM27Corrugator: [
    new PLCVariable('SpeedSetMaximum', dataTypes.UDINT),
    new PLCVariable('ScalingFactor', dataTypes.UDINT),
    new PLCVariable('SpeedStep', dataTypes.UINT),
    new PLCVariable('HeightAdj[0]', dataTypes.INT),
    new PLCVariable('HeightAdj[1]', dataTypes.INT),
    new PLCVariable('HeightAdj[2]', dataTypes.INT),
    new PLCVariable('HeightAdj[3]', dataTypes.INT),
    new PLCVariable('HeightAdj[4]', dataTypes.INT),
    new PLCVariable('HeightAdj[5]', dataTypes.INT),
    new PLCVariable('HeightAdj[6]', dataTypes.INT),
    new PLCVariable('HeightAdj[7]', dataTypes.INT),
    new PLCVariable('HeightAdj[8]', dataTypes.INT),
    new PLCVariable('HeightAdj[9]', dataTypes.INT),
    new PLCVariable('PressureSetValue[0]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[1]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[2]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[3]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[4]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[5]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[6]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[7]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[8]', dataTypes.UINT),
    new PLCVariable('PressureSetValue[9]', dataTypes.UINT),
    new PLCVariable('AutoSpeedMax', dataTypes.BOOL)
  ],

  type_IGS_Recipe: [
    new PLCVariable('CalibrationFactor', dataTypes.REAL),
    new PLCVariable('StartThreshold', dataTypes.REAL),
    new PLCVariable('MaxRPM', dataTypes.REAL),
    new PLCVariable('DefaultFeedrate', dataTypes.REAL),
    new PLCVariable('CalmingTime', dataTypes.UDINT),
    new PLCVariable('ImpulsesPerTurn', dataTypes.UINT),
    new PLCVariable('EmptyWeight', dataTypes.UINT),
    new PLCVariable('SMIndex', dataTypes.UINT)
  ],

  type_General_Para: [
    new PLCVariable('LoopsCurrMax', dataTypes.REAL),
    new PLCVariable('LockDosingRPM', dataTypes.REAL),
    new PLCVariable('FreeRpm', dataTypes.REAL),
    new PLCVariable('OffAfterTune', dataTypes.BOOL),
    new PLCVariable('UserRFID', dataTypes.BOOL),
    new PLCVariable('Nexxt365Used', dataTypes.BOOL),
    new PLCVariable('InputLog', dataTypes.BOOL),
    new PLCVariable('TempOffEmgcy', dataTypes.BOOL),
    new PLCVariable('Maintenance', dataTypes.BOOL),
    new PLCVariable('MirrorInverted', dataTypes.BOOL),
    new PLCVariable('TempF', dataTypes.BOOL)
  ],
}

const RecipeInternal = {  
  /**
   * Rezepttabelle ist initialisiert
   *
   * @type {boolean}
   */
  recipeInit: false,
  
  /**
   * Tagtabelle ist initialisiert
   *
   * @type {boolean}
   */
  tagInit: false,

  /**
   * Wertetabelle ist initialisiert
   *
   * @type {boolean}
   */
  valueInit: false,

  /**
   * Tabelle mit allen Rezepturen
   *
   * @type {Array<ModelRecipe>}
   */
  recipeTable: [],

  /**
   * Tabelle mit allen Tags
   *
   * @type {Array<ModelTag>}
   */
  tagTable: [],

  /**
   * Tabelle mit allen Rezeptbezogenen PLC-Werten
   *
   * @type {Array<ModelValue>}
   */
  valueTable: [],

  /**
   * Liest die Variablentabelle aus einer Datei ein
   * 
   * @returns {Promise}
   */
  FileHandling_ValueTableReadFromFile: function() {
    return new Promise((resolve, reject) => {
      this.valueTable.splice(0, this.valueTable.length);  //leeren
  
      HMIRuntime.FileSystem.ReadFile(valueFile, 'utf8')
      .then((content) => {
        content.split('\n').forEach((line, i) => {      
          if (i !== 0) {
            let model = new ModelValue();
            model.deserialize(line);
            if (model.deserialize(line)) {
                this.valueTable.push(model);
            }
          }
        });
        HMIRuntime.Trace('Loaded ValueTable');
        resolve();
      },() => {
        HMIRuntime.Trace('Not found ValueTable');
        resolve();
      })
      .catch(() => {
        HMIRuntime.Trace('Failure ValueTable');
        reject();
      });  
    });
  },

  /**
   * Liest die Rezepttabelle aus einer Datei ein
   * 
   * @returns {Promise}
   */
  FileHandling_RecipeTableReadFromFile: function() {
    return new Promise((resolve, reject) => {
      this.recipeTable.splice(0, this.recipeTable.length);  //leeren
      
      HMIRuntime.FileSystem.ReadFile(recipeFile, 'utf8')
      .then((content) => {
        content.split('\n').forEach((line, i) => {      
          if (i !== 0) {
            let model = new ModelRecipe();
            if (model.deserialize(line)) {
              this.recipeTable.push(model);
            }
          }
        });
        HMIRuntime.Trace('Loaded RecipeTable');
        resolve();
      },() => {
        HMIRuntime.Trace('Not found RecipeTable');
        resolve();
      })
      .catch(() => {
        HMIRuntime.Trace('Failure RecipeTable');
        reject();
      }); 
    }); 
  },

  /**
   * Schreibt die Variablentabelle in eine Datei
   * 
   * @returns {Promise}
   */
  FileHandling_ValueTableWriteToFile: function() {
    return new Promise((resolve, reject) => {
      const headerLine = ['RecipeId', 'PLCRid', 'PLCVariable', 'PLCValue']
        .join(delimiter);
      const content = [headerLine]
        .concat(this.valueTable      
          .sort((a,b) => { return a.recipeId - b.recipeId; })
          .map(date => date.serialize())
        )
        .join('\n');
    
      HMIRuntime.FileSystem.CreateDirectory(recipePath);
      HMIRuntime.FileSystem.WriteFile(valueFile, content, 'utf8')
        .then(() => resolve(),() => reject())
        .catch(() => reject());  
    });
  },

  /**
   * Schreibt die Rezepttabelle aus eine Datei
   * 
   * @returns {Promise}
   */
  FileHandling_RecipeTableWriteToFile: function() {
    return new Promise((resolve, reject) => {
      const headerLine = ['RecipeId', 'ProductName', 'VariantName', 'Description', 'LastSaved']
        .join(delimiter);
      
      const content = [headerLine]
        .concat(this.recipeTable
          .sort((a,b) => { return a.recipeId - b.recipeId; })
          .map(recipe => recipe.serialize())
        )
        .join('\n');
      
      HMIRuntime.FileSystem.CreateDirectory(recipePath);
      HMIRuntime.FileSystem.WriteFile(recipeFile, content, 'utf8')
        .then(() => resolve(),() => reject())
        .catch(() => reject());  
    }); 
  },



  /**
   * Setzt die Tabellen zurück
   * 
   * @returns {void}
   */
  Initialize_ResetTables: function() {
    this.valueInit = false;
    this.recipeInit = false;
    this.tagInit = false;

    this.valueTable.splice(0, this.valueTable.length);
    this.recipeTable.splice(0, this.recipeTable.length);
    this.tagTable.splice(0, this.tagTable.length);
  },

  /**
   * Initialisiert die Rezepttabelle
   * 
   * @returns {Promise}
   */
  Initialize_RecipeTable: function() {
    return new Promise((resolve, reject) => {
      if (!this.recipeInit) {
        HMIRuntime.Trace('Start Initialize_RecipeTable');
        this.recipeInit = true;
        this.FileHandling_RecipeTableReadFromFile()
        .then(() => {
          HMIRuntime.Trace('End Initialize_RecipeTable - Loaded');
          resolve();
        },() => {
          HMIRuntime.Trace('End Initialize_RecipeTable - Not loaded');
          resolve();
        });
      } else {
        resolve();
      }
    });
  },

  /**
   * Initialisiert die PLC-Wert-Tabelle
   * 
   * @returns {Promise}
   */
  Initialize_ValueTable: function() {
    return new Promise((resolve, reject) => {
      if (!this.valueInit) {
        HMIRuntime.Trace('Start Initialize_ValueTable');
        this.valueInit = true;
        this.FileHandling_ValueTableReadFromFile()
          .then(() => {
            HMIRuntime.Trace('End Initialize_ValueTable - Loaded');
            resolve();
          },() => {
            HMIRuntime.Trace('End Initialize_ValueTable - Not loaded');
            resolve();
          });
      } else {
        resolve();
      }
    });
  },

  /**
   * Initialisiert die HMI-Tag-Tabelle
   * 
   * @returns {Promise}
   */
  Initialize_TagTable: function() {
    return new Promise((resolve, reject) => {
      if (!this.tagInit) {
        HMIRuntime.Trace('Start Initialize_TagTable');
        this.tagInit = true;
        this.tagTable.splice(0, this.tagTable.length);  //leeren
      
        let tsSize = new Tags.CreateTagSet([
          "DB_Recipe_Parameters.Size.TempZone",
          "DB_Recipe_Parameters.Size.TempGroup",
          "DB_Recipe_Parameters.Size.Act",
          "DB_Recipe_Parameters.Size.Set",
          "DB_Recipe_Parameters.Size.State",
          "DB_Recipe_Parameters.Size.SawControl",
          "DB_Recipe_Parameters.Size.MeltpumpControl",
          "DB_Recipe_Parameters.Size.EM27",
          "DB_Recipe_Parameters.Size.IGS"
        ]);
        tsSize.Read();
        let sizeTempZone = tsSize[0].Value;
        let sizeTempGroup = tsSize[1].Value
        let sizeAct = tsSize[2].Value;
        let sizeSet = tsSize[3].Value;
        let sizeState = tsSize[4].Value;
        let sizeSawControl = tsSize[5].Value;
        let sizeMeltpumpControl = tsSize[6].Value;
        let sizeEM27 = tsSize[7].Value;
        let sizeIGS = tsSize[8].Value;
        
      
        let ts = new Tags.CreateTagSet();
        for (let i = 0; i <= sizeTempZone; i++) {
          ts.Add('DB_Recipe_Parameters.Zones[' + i + '].RID');
        }
        for (let i = 0; i <= sizeTempGroup; i++) {
          ts.Add('DB_Recipe_Parameters.TempGroups[' + i + '].RID');
        }
        for (let i = 0; i <= sizeAct; i++) {
          ts.Add('DB_Recipe_Parameters.Act[' + i + '].RID');
        }
        for (let i = 0; i <= sizeSet; i++) {
          ts.Add('DB_Recipe_Parameters.Set[' + i + '].RID');
        }
        for (let i = 0; i <= sizeState; i++) {
          ts.Add('DB_Recipe_Parameters.State[' + i + '].RID');
        }
        for (let i = 0; i <= sizeSawControl; i++) {
          ts.Add('DB_Recipe_Parameters.SawControl[' + i + '].RID');
        }
        for (let i = 0; i <= sizeMeltpumpControl; i++) {
          ts.Add('DB_Recipe_Parameters.MeltPumpControl[' + i + '].RID');
        }
        ts.Add('DB_Recipe_Parameters.MeterWeigthControl.RID');

        for (let i = 0; i <= sizeEM27; i++) {
          ts.Add('DB_Recipe_Parameters.EM27Puller[' + i + '].RID');
          ts.Add('DB_Recipe_Parameters.EM27PullerCom[' + i + '].RID');
          ts.Add('DB_Recipe_Parameters.EM27Corrugator[' + i + '].RID');
          ts.Add('DB_Recipe_Parameters.EM27CorrugatorCom[' + i + '].RID');
          ts.Add('DB_Recipe_Parameters.EM27Saw[' + i + '].RID');
          ts.Add('DB_Recipe_Parameters.EM27SawCom[' + i + '].RID');
        }
        ts.Add('DB_Recipe_Parameters.EM27Extruder.RID');

        for (let i = 0; i <= sizeIGS; i++) {
          ts.Add('DB_Recipe_Parameters.IGS[' + i + '].RID');
        }

        ts.Add('DB_Recipe_Parameters.General.RID');
        
      
        ts.Read();
      
        for (let i = 0; i <= sizeTempZone; i++) {
          let recVar = 'DB_Recipe_Parameters.Zones[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.Zones[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_TempZone_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeTempGroup; i++) {
          let recVar = 'DB_Recipe_Parameters.TempGroups[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.TempGroups[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_TempGroup_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeAct; i++) {
          let recVar = 'DB_Recipe_Parameters.Act[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.Act[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_Act_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeSet; i++) {
          let recVar = 'DB_Recipe_Parameters.Set[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.Set[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_Set_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeState; i++) {
          let recVar = 'DB_Recipe_Parameters.State[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.State[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_State_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeSawControl; i++) {
          let recVar = 'DB_Recipe_Parameters.SawControl[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.SawControl[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_SawControl_Para.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeMeltpumpControl; i++) {
          let recVar = 'DB_Recipe_Parameters.MeltPumpControl[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.MeltPumpControl[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_MeltPumpControl_Para.map(variable => new PLCValue(variable))));
          }
        }
        {
          let recVar = 'DB_Recipe_Parameters.MeterWeigthControl.Recipe';
          let ridVar = 'DB_Recipe_Parameters.MeterWeigthControl.RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_LINE_Meterweight_Para.map(variable => new PLCValue(variable))));
          }
        }

        for (let i = 0; i <= sizeEM27; i++) {
          let recVar = 'DB_Recipe_Parameters.EM27Puller[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.EM27Puller[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_EM27Puller.map(variable => new PLCValue(variable))));
          }

          recVar = 'DB_Recipe_Parameters.EM27PullerCom[' + i + '].Recipe';
          ridVar = 'DB_Recipe_Parameters.EM27PullerCom[' + i + '].RID';
          rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_CanSlave.map(variable => new PLCValue(variable))));
          }

          recVar = 'DB_Recipe_Parameters.EM27Saw[' + i + '].Recipe';
          ridVar = 'DB_Recipe_Parameters.EM27Saw[' + i + '].RID';
          rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_EM27Saw.map(variable => new PLCValue(variable))));
          }

          recVar = 'DB_Recipe_Parameters.EM27SawCom[' + i + '].Recipe';
          ridVar = 'DB_Recipe_Parameters.EM27SawCom[' + i + '].RID';
          rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_CanSlave.map(variable => new PLCValue(variable))));
          }

          recVar = 'DB_Recipe_Parameters.EM27Corrugator[' + i + '].Recipe';
          ridVar = 'DB_Recipe_Parameters.EM27Corrugator[' + i + '].RID';
          rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_EM27Corrugator.map(variable => new PLCValue(variable))));
          }

          recVar = 'DB_Recipe_Parameters.EM27CorrugatorCom[' + i + '].Recipe';
          ridVar = 'DB_Recipe_Parameters.EM27CorrugatorCom[' + i + '].RID';
          rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_CanSlave.map(variable => new PLCValue(variable))));
          }
        }
        {
          let recVar = 'DB_Recipe_Parameters.EM27Extruder.Recipe';
          let ridVar = 'DB_Recipe_Parameters.EM27Extruder.RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_EM27_Para_CanMaster.map(variable => new PLCValue(variable))));
          }
        }
        for (let i = 0; i <= sizeIGS; i++) {
          let recVar = 'DB_Recipe_Parameters.IGS[' + i + '].Recipe';
          let ridVar = 'DB_Recipe_Parameters.IGS[' + i + '].RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_IGS_Recipe.map(variable => new PLCValue(variable))));
          }
        }
        {
          let recVar = 'DB_Recipe_Parameters.General.Recipe';
          let ridVar = 'DB_Recipe_Parameters.General.RID';
          let rid = ts(ridVar).Value;
          if (rid !== '') {
            this.tagTable.push(new ModelTag(recVar, rid, RecipeVariableTypes.type_General_Para.map(variable => new PLCValue(variable))));
          }
        }


        HMIRuntime.Trace('End Initialize_TagTable');
      }

      resolve();
    });
  },

  /**
   * Liest alle PLC-Variablen in die TagTable
   * 
   * @returns {Promise}
   */
  PLC_UploadValuesFromPLC: function() {
    return new Promise((resolve, reject) => {
      this.Initialize_TagTable()
      .finally(() => {
        HMIRuntime.Trace('Start PLC_UploadValuesFromPLC');
        Tags("DB_Recipe_Control_Save").Write(true);
    
        let timer = 0;
        let timeout = 0;
        let _this = this;
        function Wait() {
          if (!Tags("DB_Recipe_Control_Save").Read() && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);
            timer = 0;
            const ts = new Tags.CreateTagSet(_this.tagTable.map(tag => tag.tagName));
            ts.Read();
            for (const tag of _this.tagTable) {
              tag.b64 = ts(tag.tagName).Value;
              tag.decode();
            }
            HMIRuntime.Trace('End PLC_UploadValuesFromPLC');
            resolve();
          } else {
            timeout += 1;
            if (timeout > 10) {
              HMIRuntime.Timers.ClearInterval(timer);
              HMIRuntime.Trace('Failed PLC_UploadValuesFromPLC');
              reject();
            }
          }
        }

        timer = HMIRuntime.Timers.SetInterval(Wait, 1000);
      });
    });
  },

  /**
   * Schreibt alle PLC-Variablen aus der TagTable in die PLC
   * 
   * @returns {Promise}
   */
  PLC_DownloadValuesToPLC: function(memoryDump) {
    return new Promise((resolve, reject) => {
      this.Initialize_TagTable()
      .finally(() => {
        HMIRuntime.Trace('Start PLC_DownloadValuesToPLC');
        const ts = new Tags.CreateTagSet(this.tagTable.map(tag => tag.tagName));    
        for (const tag of this.tagTable) {
          tag.encode();
          ts(tag.tagName).Value = tag.b64;     
        }
        ts.Write();

        if (memoryDump === true) {
          Tags("DB_Recipe_Control_Load").Write(2);
        } else {
          Tags("DB_Recipe_Control_Load").Write(1);
        }

        HMIRuntime.Trace('End PLC_DownloadValuesToPLC');
        resolve();
      });
    });
  },

  /**
   * Speichert die Werte für das übergebene Rezept
   * 
   * @param {number} recipeId - ID der Rezeptur
   * @returns {Promise}
   */
  Data_StoreValues: function(recipeId) {
    return new Promise((resolve, reject) => {
      Promise.all([this.Initialize_ValueTable(), this.Initialize_RecipeTable(), this.Initialize_TagTable(), this.PLC_UploadValuesFromPLC()])
      .then(() => {
        HMIRuntime.Trace('Start Data_StoreValues');
        if (recipeId > 0) {
          let recipe = this.recipeTable.find(x => x.recipeId == recipeId);
          if (recipe === undefined) {
            HMIRuntime.Trace('Failure at Data_StoreValues - Not existing');
          } else {
            let newArray = this.valueTable.filter(x => x.recipeId != recipeId);
            for (const tag of this.tagTable) {
              for (const plcValue of tag.plcValues) {
                let value = this.valueTable.find(x => x.recipeId == recipeId && x.plcRID == tag.plcRID && x.plcVariableName == plcValue.plcVariable.name);
                if (value === undefined) {
                  newArray.push(new ModelValue(recipeId, tag.plcRID, plcValue.plcVariable.name, plcValue.value));
                } else {
                  value.plcValueString = plcValue.value.toString();
                  newArray.push(value);
                }
              }
            }
            this.valueTable.splice(0, this.valueTable.length);  //leeren
            for (const element of newArray) {
              this.valueTable.push(element);
            }

            recipe.lastSaved = new Date().toISOString();
            return Promise.all([this.FileHandling_ValueTableWriteToFile(), this.FileHandling_RecipeTableWriteToFile()]);    
          }
        } else {
          HMIRuntime.Trace('Failure at Data_StoreValues - Zero-ID');
        }
      })
      .then(() => {
        HMIRuntime.Trace('End Data_StoreValues');
        resolve();
      }, () => {
        HMIRuntime.Trace('Failed Data_StoreValues - Writing not possible');
        reject();
      }); 
    });
  },

  /**
   * Lädt die Werte für das übergebene Rezept
   * 
   * @param {number} recipeId - ID der Rezeptur
   * @param {boolean} memoryDump - Speicherabbild laden
   * @returns {Promise}
   */
  Data_LoadValues: function(recipeId, memoryDump) {
    return new Promise((resolve, reject) => { 
      Promise.all([this.Initialize_ValueTable(), this.Initialize_RecipeTable(), this.Initialize_TagTable()])
      .finally(() => {
        HMIRuntime.Trace('Start Data_LoadValues');
        if (recipeId > 0) {
          let recipe = this.recipeTable.find(x => x.recipeId == recipeId);
          if (recipe === undefined) {
            HMIRuntime.Trace('Failure at Data_LoadValues - Not existing recipe');
            reject();
          } else {
            let values = this.valueTable.filter(x => x.recipeId == recipeId);
            if (values.length == 0) {
              HMIRuntime.Trace('Failure at Data_LoadValues - Not existing value');
              reject();
            } else {
              for (const value of values) {
                let tag = this.tagTable.find(x => x.plcRID == value.plcRID);
                if (tag === undefined) {
                  HMIRuntime.Trace('Failure at Data_LoadValues - Not existing tag ' + value.plcRID);
                } else {
                  let plcValue = tag.plcValues.find(x => x.plcVariable.name == value.plcVariableName);
                  if (plcValue === undefined) {
                    HMIRuntime.Trace('Failure at Data_LoadValues - Not existing PLCValue ' + value.plcVariableName);
                  } else {
                    plcValue.valueFromString(value.plcValueString);
                  }
                }
              }

              this.PLC_DownloadValuesToPLC(memoryDump)
                .then(() => {
                  HMIRuntime.Trace('End Data_LoadValues');
                  resolve();
                }, () => {
                  HMIRuntime.Trace('Failure at Data_LoadValues - Download');
                  reject();
                });
            }     
          }        
        } else {
          HMIRuntime.Trace('Failure at Data_LoadValues - Zero-ID');
          reject();
        }
      });
    });
  },

  /**
   * Entfernt die Werte für das übergebene Rezept
   * 
   * @param {number} recipeId - ID der Rezeptur
   * @returns {Promise}
   */
  Data_RemoveValues: function(recipeId) {  
    return new Promise((resolve, reject) => { 
      this.Initialize_ValueTable()
      .finally(() => {
        HMIRuntime.Trace('Start Data_RemoveValues');
        if (recipeId > 0) {
          let newArray = this.valueTable.filter(x => x.recipeId != recipeId);
          if (newArray.length == this.valueTable.length) {
            HMIRuntime.Trace('Failure at Data_RemoveValues - Not existing');
            reject();
          } else {
            this.valueTable.splice(0, this.valueTable.length);  //leeren
            for (const element of newArray) {
              this.valueTable.push(element);
            }
            return this.FileHandling_ValueTableWriteToFile();
          }
        } else {
          HMIRuntime.Trace('Failure at Data_RemoveValues - Zero-ID');
          reject();
        }
      })
      .then(() => {
        HMIRuntime.Trace('End Data_RemoveValues');
        resolve();
      }, () => {
        HMIRuntime.Trace('Failed Data_RemoveValues - Writing not possible');
        reject();
      }); 
    });
  },

  /**
   * Erzeugt die Werte-Strings für das Info-Panel
   * 
   * @param {number} recipeId - ID der Rezeptur
   * @param {boolean} simple - Einfache Rezepturanzeige
   * @returns {Promise<string>} - String für das Info-Panel
   */
  Data_GetValueInformation: function(recipeId, simple) {
    return new Promise((resolve, reject) => { 
      this.Initialize_ValueTable()
      .finally(() => {
        let res = [];
        let infoTable = this.valueTable
          .filter(x => x.recipeId == recipeId);
        let rids = infoTable
          .map(x => x.plcRID);
        rids = rids.filter((a, b) => rids.indexOf(a) === b);

        let next = '';
        for (const rid of rids) {
          try {
            let fullLine = '' + rid + '\n';
            let simpleLine = '';
            let used = false;
            for (const item of infoTable.filter(x => x.plcRID == rid)) {
              fullLine += '' + item.plcVariableName + ': ' + item.plcValueString + '\n';
              if (!simple || simpleValues.some(x => item.plcVariableName.includes(x)) && parseInt(item.plcValueString) > 0) {
                used = true;
                simpleLine += item.plcValueString + '\n';
              }
            }
        
            if (used) {
              let text = '';
              if (simple) {
                text = this.Data_GetTextForValueInformation(fullLine) + ': ' + simpleLine;
              } else {
                text = this.Data_GetTextForValueInformation(fullLine) + '\n' + fullLine;
              }
              if (next == '' || next.split('\n').length + text.split('\n').length <= 35) {
                if (next != '' && !simple) {
                  next += '\n\n';
                }
                next += text;
              } else {
                res.push(next);
                next = text;
              }   
            }
          } catch (error) {
            HMIRuntime.Trace(error.message);
          }
        }

        res.push(next);
        resolve(res.join(delimiter));
      });
    });
  },

  /**
   * Erzeugt den Text für das Info-Panel
   * 
   * @param {string} content - Textzeile
   * @returns {string} - Text mit Sprache
   */
  Data_GetTextForValueInformation: function(content) {
    let ret = '';
    try {
      if (content.includes('RecipeSP1')) {  //TempZone
        let rows = content.split('\n');
        let group = parseInt(rows.find(x => x.includes('Group:')).split(' ')[1]);
        let name = parseInt(rows.find(x => x.includes('Name:')).split(' ')[1]);
        let num = parseInt(rows.find(x => x.includes('SubNum:')).split(' ')[1]);
        let grouptext = HMIRuntime.Resources.TextLists('@Default.Groups').Item(group).Item(HMIRuntime.Language);
        let nametext = HMIRuntime.Resources.TextLists('@Default.Zones').Item(name).Item(HMIRuntime.Language);
        let numtext = HMIRuntime.Resources.TextLists('@Default.ID').Item(num).Item(HMIRuntime.Language);
        
        ret = grouptext + ' - ' + nametext + ' ' + numtext ;

      } else if (content.includes('LineLoweringValue') || content.includes('RampUpTime')) { //Act oder Set
        let rows = content.split('\n');
        let group = parseInt(rows.find(x => x.includes('Group:')).split(' ')[1]);
        let name = parseInt(rows.find(x => x.includes('Name:')).split(' ')[1]);
        let num = parseInt(rows.find(x => x.includes('SubNum:')).split(' ')[1]);
        let grouptext = HMIRuntime.Resources.TextLists('@Default.Groups').Item(group).Item(HMIRuntime.Language);
        let nametext = HMIRuntime.Resources.TextLists('@Default.Indications').Item(name).Item(HMIRuntime.Language);
        let numtext = HMIRuntime.Resources.TextLists('@Default.ID').Item(num).Item(HMIRuntime.Language);
        
        ret = grouptext + ' - ' + nametext + ' ' + numtext;

      } else if (content.includes('AlarmMode')) { //State
        let rows = content.split('\n');
        let group = parseInt(rows.find(x => x.includes('Group:')).split(' ')[1]);
        let name = parseInt(rows.find(x => x.includes('Name:')).split(' ')[1]);
        let num = parseInt(rows.find(x => x.includes('SubNum:')).split(' ')[1]);
        let grouptext = HMIRuntime.Resources.TextLists('@Default.Groups').Item(group).Item(HMIRuntime.Language);
        let nametext = HMIRuntime.Resources.TextLists('@Default.States').Item(name).Item(HMIRuntime.Language);
        let numtext = HMIRuntime.Resources.TextLists('@Default.ID').Item(num).Item(HMIRuntime.Language);
        
        ret = grouptext + ' - ' + nametext + ' ' + numtext;

      } else if (content.includes('MinRpmPump')) { //Schmelzepumpe
        ret = HMIRuntime.Resources.TextLists('@Default.Groups').Item(110).Item(HMIRuntime.Language);

      } else if (content.includes('XP:') && content.includes('Limit:')) { //Metergewicht
        ret = HMIRuntime.Resources.TextLists('@Default.Indications').Item(27).Item(HMIRuntime.Language);

      } else if (content.includes('SampleLength')) { //Säge
        ret = HMIRuntime.Resources.TextLists('@Default.Groups').Item(60).Item(HMIRuntime.Language);
      }
    } catch (error) {
      HMIRuntime.Trace(error.message);
    }

    return ret;
  },

  /**
   * Fügt ein neues Rezept hinzu
   * @param {String} productName - Produktname
   * @param {String} variantName - Variante
   * @param {String} descriptionText - Beschreibung des Rezepts
   * @returns {Promise<number>} - ID des neuen Rezepts
   */
  Data_AddRecipe: function(productName, variantName, descriptionText) {  
    return new Promise((resolve, reject) => { 
      let newRecipeId = 0;
      this.Initialize_RecipeTable()
      .finally(() => {
        HMIRuntime.Trace('Start Data_AddRecipe');
        newRecipeId = this.recipeTable.length ? Math.max(...this.recipeTable.map(x => x.recipeId)) + 1 : 1;
        this.recipeTable.push(new ModelRecipe(newRecipeId, productName, variantName, descriptionText));
        
        return this.FileHandling_RecipeTableWriteToFile();
      })
      .then(() => {
        HMIRuntime.Trace('End Data_AddRecipe');
        resolve(newRecipeId);
      }, () => {
        HMIRuntime.Trace('Failed Data_AddRecipe - Writing not possible');
        reject();
      }); 
    }); 
  },

  /**
   * Bearbeitet ein bestehendes Rezept
   * @param {Number} recipeId - ID des Rezeptes
   * @param {String} productName - Produktname
   * @param {String} variantName - Variante
   * @param {String} descriptionText - Beschreibung des Rezepts
   * @returns {Promise}
   */
  Data_UpdateRecipe: function(recipeId, productName, variantName, descriptionText) {  
    return new Promise((resolve, reject) => { 
      this.Initialize_RecipeTable()
      .finally(() => {
        HMIRuntime.Trace('Start Data_UpdateRecipe');
        if (recipeId > 0) {
          let recipe = this.recipeTable.find(x => x.recipeId == recipeId);
          if (recipe === undefined) {
            HMIRuntime.Trace('Failure at Data_UpdateRecipe - Not existing');
            reject();
          } else {
            recipe.productName = productName;
            recipe.variantName = variantName;
            recipe.descriptionText = descriptionText;
    
            return this.FileHandling_RecipeTableWriteToFile();
          }
        } else {
          HMIRuntime.Trace('Failure at Data_UpdateRecipe - Zero-ID');
          reject();
        }
      })
      .then(() => {
        HMIRuntime.Trace('End Data_UpdateRecipe');
        resolve();
      }, () => {
        HMIRuntime.Trace('Failed Data_UpdateRecipe - Writing not possible');
        reject();
      })
      .catch(() => {
        HMIRuntime.Trace('Failure UpdateTable');
        reject();
      });
    });
  },

  /**
   * Gibt ein Rezept zurück
   * 
   * @param {Number} recipeId - ID des Rezeptes
   * @returns {Promise<ModelRecipe>} - Instanz des Rezeptes
   */
  Data_GetRecipe: function(recipeId) {  
    return new Promise((resolve, reject) => {
      let recipe;
    
      this.Initialize_RecipeTable()
      .finally(() => {
        HMIRuntime.Trace('Start Data_GetRecipe');
        if (recipeId > 0) {      
          recipe = this.recipeTable.find(x => x.recipeId == recipeId);
          if (recipe === undefined) {
            HMIRuntime.Trace('Failure at Data_GetRecipe - Not existing');
            reject();
          }     
        } else {
          HMIRuntime.Trace('Failure at Data_GetRecipe - Zero-ID');
          reject();
        }
      })
      .then(() => {
        HMIRuntime.Trace('End Data_GetRecipe');
        resolve(recipe);
      }, () => {
        HMIRuntime.Trace('Failed Data_GetRecipe');
        reject();
      }); 
    }); 
  },

  /**
   * Löscht ein Rezept
   * 
   * @param {Number} recipeId - ID des Rezeptes
   * @returns {Promise}
   */
  Data_RemoveRecipe: function(recipeId) { 
    return new Promise((resolve, reject) => { 
      this.Initialize_RecipeTable()
      .finally(() => {
        HMIRuntime.Trace('Start Data_RemoveRecipe');
        if (recipeId > 0) {
          let recipe = this.recipeTable.find(x => x.recipeId == recipeId);
          if (recipe === undefined) {
            HMIRuntime.Trace('Failure at Data_RemoveRecipe - Not existing');
            reject();
          } else {
            let index = this.recipeTable.indexOf(recipe);
            this.recipeTable.splice(index, 1);
            return this.FileHandling_RecipeTableWriteToFile();    
          }
        } else {
          HMIRuntime.Trace('Failure at Data_RemoveRecipe - Zero-ID');
          reject();
        }
      })
      .then(() => {
        HMIRuntime.Trace('End Data_RemoveRecipe');
        this.Data_RemoveValues(recipeId)
        .finally(() => resolve());
      }, () => {
        HMIRuntime.Trace('Failed Data_RemoveRecipe - Writing not possible');
        reject();
      });   
    }); 
  },

  /**
   * Sortieralgorythmus für Rezepturliste
   * 
   * @param {ModelRecipe} a - Erstes Rezept
   * @param {ModelRecipe} b - Zweites Rezept
   * @param {number} sortMode - Sortiermodus
   * @returns {boolean} - Vergleich der beiden Rezepturen
   */
  List_SortRecipeList: function(a, b, sortMode) {
    switch (sortMode) {
      case 0:
        return a.recipeId - b.recipeId;
      case 1:
        return b.recipeId - a.recipeId;
      case 2:
        return a.productName.localeCompare(b.productName);
      case 3:
        return b.productName.localeCompare(a.productName);
      case 4:
        return a.variantName.localeCompare(b.variantName);
      case 5:
        return b.variantName.localeCompare(a.variantName);
      case 6:
        return a.lastSaved.localeCompare(b.lastSaved);
      case 7:
        return b.lastSaved.localeCompare(a.lastSaved);
      default:
        return a.recipeId - b.recipeId;
    }
  },

  /**
   * Sortieralgorythmus für Rezepturliste
   * 
   * @param {ModelRecipe} recipe - Rezeptur
   * @param {string} filterProduct - Filter auf Produkt
   * @param {string} filterVariant - Filter auf Variante
   * @returns {boolean} - Ergebnis ob das Rezept dem Filter entspricht
   */
  List_FilterRecipeList: function(recipe, filterProduct, filterVariant) {
    let resProduct = (filterProduct === '') || recipe.productName.toLocaleLowerCase().includes(filterProduct.toLocaleLowerCase());
    let resVariant = (filterVariant === '') || recipe.variantName.toLocaleLowerCase().includes(filterVariant.toLocaleLowerCase());
    return resProduct && resVariant;
  },

  /**
   * Filtert die Rezepturen auf der aktuellen Seite
   * 
   * @param {number} page - Aktuelle Listenseite
   * @param {number} sortMode - Sortiermodus
   * @param {string} filterProduct - Filter auf Produkt
   * @param {string} filterVariant - Filter auf Variante
   * @returns {Promise}
   */
  List_FillRecipeList: function(page, sortMode, filterProduct, filterVariant) {
    return new Promise((resolve, reject) => { 
      this.Initialize_RecipeTable()
      .finally(() => {
        let listMax = 10;
      
        if (page === undefined) {
          page = Tags('Recipe_List_Page_Act').Read();
        }

        if (sortMode === undefined) {
          sortMode = Tags('Recipe_Load_SortMode').Read();
        }

        if (filterProduct === undefined) {
          filterProduct = Tags('Recipe_Load_FilterProduct').Read();
        }

        if (filterVariant === undefined) {
          filterVariant = Tags('Recipe_Load_FilterVariant').Read();
        }
    
        let first = (page - 1) * listMax;
        let sortetRecipes = this.recipeTable
          .filter(x => this.List_FilterRecipeList(x, filterProduct, filterVariant))
          .sort((a,b) => this.List_SortRecipeList(a, b, sortMode));
        
        let maxPage = Math.ceil(sortetRecipes.length / listMax);
        let recipes = sortetRecipes
          .slice(first, first + listMax);
        let ts = Tags.CreateTagSet([['Recipe_List_Page_Max', maxPage]]);
      
        for (let i = 0; i < listMax; i++) {        
          let listRecipeId = 'Recipe_List_RecipeId[' + i + ']';
          let listProductName = 'Recipe_List_ProductName[' + i + ']';
          let listVariantName = 'Recipe_List_VariantName[' + i + ']';
          let listLastSaved = 'Recipe_List_LastSaved[' + i + ']';

          if (recipes.length > i) {
            ts.Add([
              [listRecipeId, recipes[i].recipeId],
              [listProductName, recipes[i].productName],
              [listVariantName, recipes[i].variantName],
              [listLastSaved, recipes[i].lastSaved]
            ]);
          } else {
            ts.Add([
              [listRecipeId, 0],
              [listProductName, ''],
              [listVariantName, ''],
              [listLastSaved, '']
            ]);
          }
        }

        ts.Write();
        resolve();
      });
    });
  },
}

export const RecipeDebug = {
  /**
   * Gibt alle Rezepte am Trace aus
   * 
   * @returns {Promise}
   */
  TraceRecipes: function() { 
    return new Promise((resolve, reject) => { 
      RecipeInternal.Initialize_RecipeTable()
      .finally(() => {
        HMIRuntime.Trace('Start TraceRecipes');
        for (const recipe of RecipeInternal.recipeTable) {
          HMIRuntime.Trace('Recipe - Id: ' + recipe.recipeId + ', Product: ' + recipe.productName + ', Variant: ' + recipe.variantName + ', LastSaved: ' + recipe.lastSaved);
        }
        HMIRuntime.Trace('End TraceRecipes');
        resolve();
      });
    });
  },

  /**
   * Gibt alle Rezept-Werte am Trace aus
   * 
   * @returns {Promise}
   */
  TraceValues: function() { 
    return new Promise((resolve, reject) => { 
      RecipeInternal.Initialize_ValueTable()
      .finally(() => {
        HMIRuntime.Trace('Start TraceValues');
        for (const value of RecipeInternal.valueTable) {
          HMIRuntime.Trace('Recipe: ' + value.recipeId + ', RID: ' + value.plcRID + ', PLCVar: ' + value.plcVariableName + ', PLCVal: ' + value.plcValueString);
        }
        HMIRuntime.Trace('End TraceValues');
        resolve();
      });
    });
  },

  /**
   * Gibt alle Tags am Trace aus
   * 
   * @returns {Promise}
   */
  TraceTagTable: function() { 
    return new Promise((resolve, reject) => { 
      RecipeInternal.Initialize_TagTable()
      .finally(() => {
        HMIRuntime.Trace('Start TraceTagTable');
        for (const tag of RecipeInternal.tagTable) {
          for (const value of tag.plcValues) {
            HMIRuntime.Trace('TagName: ' + tag.tagName + ', RID: ' + tag.plcRID + ', VarName: ' + value.plcVariable.name + ', VarType: ' + value.plcVariable.dataType.type + ', Value: ' + value.value + ', Bytelength: ' + value.bytes.length);
          }
        }
        HMIRuntime.Trace('End TraceTagTable');
        resolve();
      });
    });
  },
}

export const RecipeScreen = {
  /**
   * Öffnet das Popup um ein neues Rezept anzulgen
   * 
   * @returns {void}
   */
  OpenAddPopup: function () {
    let timer = 0;  

    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDescription);
    UI.DataSet.Remove(dsDone);
    
    function Wait() {
      if (UI.DataSet.Exists(dsProduct) && UI.DataSet.Exists(dsVariant) && UI.DataSet.Exists(dsDescription) && UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet.Item(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
    
            if (UI.DataSet.Item(dsDone) == 2) {
              RecipeInternal.Data_AddRecipe(UI.DataSet(dsProduct), UI.DataSet(dsVariant), UI.DataSet(dsDescription))
                .then((selected) => RecipeInternal.Data_StoreValues(selected)
                  .then(() => RecipeInternal.Data_GetRecipe(selected)
                    .then((recipe) => {
                      RecipeInternal.List_FillRecipeList()
                        .finally(() => {
                         Tags("DB_Recipe_CurrentRecipe").Write(recipe.getName());
                         HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
                          HMIRuntime.Resources.TextLists("@Default.MessageText").Item(9),
                          Tags("DB_User_CurrentUser_Name").Read(),
                          recipe.getName()
                          );
                        Tags("Recipe_PLCExchange").Write(2);
                        HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);                    
                        })
                    })            
                  , () => {
                    //Rejected Data_StoreValues
                    Tags("Recipe_PLCExchange").Write(1);
                    HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);
                  })
                , () => {
                  //Rejected Data_AddRecipe
                  Tags("Recipe_PLCExchange").Write(1);
                  HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);
                })
          }
          UI.DataSet.Remove(dsProduct);
          UI.DataSet.Remove(dsVariant);
          UI.DataSet.Remove(dsDescription);
          UI.DataSet.Remove(dsDone);
        }
      }
    }

    UI.SysFct.ChangeScreen("POPUP_Recipe_AddRecipe", "../PopUp");
    timer = HMIRuntime.Timers.SetInterval(Wait, 100);
  },

  /**
   * Öffnet das Popup um ein Rezept zu löschen
   * 
   * @returns {void}
   */
  OpenDeletePopup: function() {
    let timer = 0;  
    let selected = Tags("Recipe_List_SelectedId").Read();
    let recipeName = '';
  
    UI.DataSet.Remove(dsDone);
    
    function Wait() {
      if (UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet.Item(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
     
            if (UI.DataSet.Item(dsDone) == 2) {
              RecipeInternal.Data_RemoveRecipe(selected)
                .then(() => RecipeInternal.List_FillRecipeList())
                .finally(() => {
                  HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
                      HMIRuntime.Resources.TextLists("@Default.MessageText").Item(11),
                      Tags("DB_User_CurrentUser_Name").Read(),
                      recipeName
                    );
                });
            }
            UI.DataSet.Remove(dsProduct);
            UI.DataSet.Remove(dsVariant);
            UI.DataSet.Remove(dsDone);
        }
      }
    }
  
    RecipeInternal.Data_GetRecipe(selected)
      .then((result) => {
          recipeName = result.getName();
          UI.DataSet.Add(dsProduct, result.productName);
          UI.DataSet.Add(dsVariant, result.variantName);
  
          UI.SysFct.ChangeScreen("POPUP_Recipe_DeleteRecipe", "../PopUp");
          timer = HMIRuntime.Timers.SetInterval(Wait, 100);
      });
  },

  /**
   * Öffnet das Popup um ein Rezept zu bearbeiten
   * 
   * @returns {void}
   */
  OpenEditPopup: function() {
    let timer = 0;  
    let selected = Tags("Recipe_List_SelectedId").Read();
  
    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDescription);
    UI.DataSet.Remove(dsDone);
    
    function Wait() {
      if (UI.DataSet.Exists(dsProduct) && UI.DataSet.Exists(dsVariant) && UI.DataSet.Exists(dsDescription) && UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet.Item(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
     
            if (UI.DataSet(dsDone) == 2) {
              RecipeInternal.Data_UpdateRecipe(selected, UI.DataSet(dsProduct), UI.DataSet(dsVariant), UI.DataSet(dsDescription))
                .then(() => RecipeInternal.List_FillRecipeList());
            }
  
            UI.DataSet.Remove(dsProduct);
            UI.DataSet.Remove(dsVariant);
            UI.DataSet.Remove(dsDescription);
            UI.DataSet.Remove(dsDone);
        }
      }
    }
  
    RecipeInternal.Data_GetRecipe(selected)
      .then((result) => {
          UI.DataSet.Add(dsProduct, result.productName);
          UI.DataSet.Add(dsVariant, result.variantName);
          UI.DataSet.Add(dsDescription, result.descriptionText);
  
          UI.SysFct.ChangeScreen("POPUP_Recipe_EditRecipe", "../PopUp");
          timer = HMIRuntime.Timers.SetInterval(Wait, 100);
      });
  },

  /**
   * Öffnet das Popup um die Liste zu filtern
   * 
   * @returns {void}
   */
  OpenFilterPopup: function() {
    let timer = 0;  
  
    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDone);
    
    function Wait() {
      if (UI.DataSet.Exists(dsProduct) && UI.DataSet.Exists(dsVariant) && UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet.Item(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
     
            if (UI.DataSet(dsDone) == 2) {
              Tags.CreateTagSet([
                ["Recipe_Load_FilterProduct", UI.DataSet(dsProduct)], 
                ["Recipe_Load_FilterVariant", UI.DataSet(dsVariant)],
                ["Recipe_List_Page_Act", 1], 
                ["Recipe_List_SelectedId", 0]
              ]).Write();
  
              RecipeInternal.List_FillRecipeList(1, undefined, UI.DataSet(dsProduct), UI.DataSet(dsVariant));
            }
            UI.DataSet.Remove(dsProduct);
            UI.DataSet.Remove(dsVariant);
            UI.DataSet.Remove(dsDone);
        }
      }
    }
  
    UI.DataSet.Add(dsProduct, Tags("Recipe_Load_FilterProduct").Read());
    UI.DataSet.Add(dsVariant, Tags("Recipe_Load_FilterVariant").Read());
  
    UI.SysFct.ChangeScreen("POPUP_Recipe_Filter", "../PopUp");
    timer = HMIRuntime.Timers.SetInterval(Wait, 100);
  },

  /**
   * Öffnet das Popup für das Info-Panel
   * 
   * @returns {void}
   */
  OpenInfoPopup: function(simple) {
    let selected = Tags("Recipe_List_SelectedId").Read();
  
    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDescription);
    UI.DataSet.Remove(dsContent);
  
    RecipeInternal.Data_GetRecipe(selected)
      .then((rec) => {
        RecipeInternal.Data_GetValueInformation(selected, simple)
            .then((res) => {  
              UI.DataSet.Add(dsProduct, rec.productName);
              UI.DataSet.Add(dsVariant, rec.variantName);
              UI.DataSet.Add(dsDescription, rec.descriptionText);
              UI.DataSet.Add(dsContent, res);
              UI.SysFct.ChangeScreen("POPUP_Recipe_Info", "../PopUp");
            });
      });
  },
  
  /**
   * Springt in der Liste eine Seite weiter
   * 
   * @returns {void}
   */
  ListNext: function() {
    let ts = Tags.CreateTagSet(["Recipe_List_Page_Act", "Recipe_List_Page_Max"]);
    ts.Read();
  
    let act = ts[0].Value;
    let max = ts[1].Value;
  
    if (act >= max) {
      act = 1;
    } else {
      act += 1;
    }
  
    Tags.CreateTagSet([
      ["Recipe_List_Page_Act", act], 
      ["Recipe_List_SelectedId", 0]]
    ).Write()
    
    RecipeInternal.List_FillRecipeList(act);
  },

  /**
   * Springt in der Liste eine Seite zurück
   * 
   * @returns {void}
   */
  ListPrev: function() {
    let ts = Tags.CreateTagSet(["Recipe_List_Page_Act", "Recipe_List_Page_Max"]);
    ts.Read();
  
    let act = ts[0].Value;
    let max = ts[1].Value;
  
    if (act <= 1) {
      act = max;
    } else {
      act -= 1;
    }
  
    Tags.CreateTagSet([
      ["Recipe_List_Page_Act", act], 
      ["Recipe_List_SelectedId", 0]]
    ).Write();
  
    RecipeInternal.List_FillRecipeList(act);
  },

  /**
   * Öffnet das Popup zum Laden eines Rezepts
   * 
   * @returns {void}
   */
  OpenLoadPopup: function() {
    let timer = 0;
    let selected = Tags("Recipe_List_SelectedId").Read();
    let recipeName = '';
  
    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDone);
  
    function Wait() {
      if (UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
     
            if (UI.DataSet(dsDone) == 2) {
              let ts = Tags.CreateTagSet(["Recipe_Load_MemoryDump", "DB_User_CurrentUser_Name"]);
              ts.Read();
          
              let memoryDump = ts[0].Value;
              let user = ts[1].Value;   
  
              RecipeInternal.Data_LoadValues(selected, memoryDump)
                .then(() => {
                  Tags("DB_Recipe_CurrentRecipe").Write(recipeName);
                  HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
                      HMIRuntime.Resources.TextLists("@Default.MessageText").Item(10),
                      user,
                      recipeName
                    );
                  Tags("Recipe_PLCExchange").Write(2);
                  HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);
                }, () => {
                  Tags("Recipe_PLCExchange").Write(1);
                  HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);
                });
            }
            Tags("Recipe_Load_MemoryDump").Write(false);
            UI.DataSet.Remove(dsProduct);
            UI.DataSet.Remove(dsVariant);
            UI.DataSet.Remove(dsDone);
        }
      }
    }
  
    RecipeInternal.Data_GetRecipe(selected)
      .then((result) => {
        recipeName = result.getName();
        UI.DataSet.Add(dsProduct, result.productName);
        UI.DataSet.Add(dsVariant, result.variantName);
        UI.SysFct.ChangeScreen("POPUP_Recipe_LoadToPLC", "../PopUp");
        timer = HMIRuntime.Timers.SetInterval(Wait, 100);
      });
  },

  /**
   * Öffnet das Popup zum Speichern eines Rezepts
   * 
   * @returns {void}
   */
  OpenSavePopup: function() {
    let timer = 0;
    let selected = Tags("Recipe_List_SelectedId").Read();
    let recipeName = '';
  
    UI.DataSet.Remove(dsProduct);
    UI.DataSet.Remove(dsVariant);
    UI.DataSet.Remove(dsDone);
  
    function Wait() {
      if (UI.DataSet.Exists(dsDone)) {
        if (UI.DataSet(dsDone) > 0 && timer != 0) {
            HMIRuntime.Timers.ClearInterval(timer);     
            timer = 0;
     
            if (UI.DataSet(dsDone) == 2) {                
              RecipeInternal.Data_StoreValues(selected)
                .then(() => {
                  RecipeInternal.List_FillRecipeList()
                    .finally(() => {
                       Tags("DB_Recipe_CurrentRecipe").Write(recipeName);
                       HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
                        HMIRuntime.Resources.TextLists("@Default.MessageText").Item(9),
                        Tags("DB_User_CurrentUser_Name").Read(),
                        recipeName
                        );
                      Tags("Recipe_PLCExchange").Write(2);
                      HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);                    
                    })
                }, () => {
                   Tags("Recipe_PLCExchange").Write(1);
                   HMIRuntime.Timers.SetTimeout(() => HMIRuntime.UI.SysFct.ChangeScreen("POPUP_None", "../PopUp"), 1000);
                });
            }
            UI.DataSet.Remove(dsProduct);
            UI.DataSet.Remove(dsVariant);
            UI.DataSet.Remove(dsDone);
        }
      }
    }
  
    RecipeInternal.Data_GetRecipe(selected)
      .then((result) => {
        let dt = new Date(result.lastSaved);
        recipeName = result.getName();
  
        if (dt instanceof Date && !isNaN(dt)) {
          UI.DataSet.Add(dsProduct, result.productName);
          UI.DataSet.Add(dsVariant, result.variantName);
          UI.SysFct.ChangeScreen("POPUP_Recipe_OverrideRecipe", "../PopUp");
        } else {        
          UI.SysFct.ChangeScreen("POPUP_Recipe_StoreWait", "../PopUp");
          UI.DataSet.Add(dsDone, 2);
        }
        timer = HMIRuntime.Timers.SetInterval(Wait, 100);
      });
  },

  /**
   * Sotiert die Liste
   * 
   * @returns {void}
   */
  SortList: function(asc, desc) {
    let sortMode = Tags("Recipe_Load_SortMode").Read();
  
    if (sortMode == asc) {
      sortMode = desc;
    } else {
      sortMode = asc;
    }
  
    Tags.CreateTagSet([
      ["Recipe_List_Page_Act", 1], 
      ["Recipe_List_SelectedId", 0],
      ["Recipe_Load_SortMode", sortMode]
    ]).Write();
    
    RecipeInternal.List_FillRecipeList(1, sortMode);
  }
}

const Base64 = {
  /**
   * Base64 Alphabet
   *
   * @type {Array<string>}
   */
  base64abc: [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
    "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "/"
  ],

  /**
   * Base64 Codes
   *
   * @type {Array<number>}
   */
  base64codes: [
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255,
    255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255,
    255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
  ],

  /**
   * Sotiert die Liste
   * 
   * @param {char} charCode - Code der in eine Zahl umgewandelt werden soll
   * @returns {number} - Umgewandelte Zahl
   */
  getBase64Code: function(charCode) {
    if (charCode >= this.base64codes.length) {
      HMIRuntime.Trace("Unable to parse base64 string.");
      return;
    }
    const code = this.base64codes[charCode];
    if (code === 255) {
      HMIRuntime.Trace("Unable to parse base64 string.");
      return;
    }
    return code;
  },

  /**
   * Wandelt ein Byte-Array in einen Base64-String um
   * 
   * @param {Array<byte>} bytes - Bytearray das konvertiert werden soll
   * @returns {string} - Base64 String
   */
  bytesToBase64: function(bytes) {
    let result = '', i, l = bytes.length;
    for (i = 2; i < l; i += 3) {
      result += this.base64abc[bytes[i - 2] >> 2];
      result += this.base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
      result += this.base64abc[((bytes[i - 1] & 0x0F) << 2) | (bytes[i] >> 6)];
      result += this.base64abc[bytes[i] & 0x3F];
    }
    if (i === l + 1) { // 1 octet yet to write
      result += this.base64abc[bytes[i - 2] >> 2];
      result += this.base64abc[(bytes[i - 2] & 0x03) << 4];
      result += "==";
    }
    if (i === l) { // 2 octets yet to write
      result += this.base64abc[bytes[i - 2] >> 2];
      result += this.base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
      result += this.base64abc[(bytes[i - 1] & 0x0F) << 2];
      result += "=";
    }
    return result;
  },

  /**
   * Wandelt  einen Base64-String in ein Byte-Array um
   * 
   * @param {string} str - Base64 String der konvertiert werden soll
   * @returns {Array<byte>} - Bytearray 
   */
  base64ToBytes: function(str) {
    if (str.length % 4 !== 0) {
      HMIRuntime.Trace("Unable to parse base64 string.");
      return;
    }
    const index = str.indexOf("=");
    if (index !== -1 && index < str.length - 2) {
      HMIRuntime.Trace("Unable to parse base64 string.");
      return;
    }
    let missingOctets = str.endsWith("==") ? 2 : str.endsWith("=") ? 1 : 0,
      n = str.length,
      result = new Uint8Array(3 * (n / 4)),
      buffer;
    for (let i = 0, j = 0; i < n; i += 4, j += 3) {
      buffer =
        this.getBase64Code(str.charCodeAt(i)) << 18 |
        this.getBase64Code(str.charCodeAt(i + 1)) << 12 |
        this.getBase64Code(str.charCodeAt(i + 2)) << 6 |
        this.getBase64Code(str.charCodeAt(i + 3));
      result[j] = buffer >> 16;
      result[j + 1] = (buffer >> 8) & 0xFF;
      result[j + 2] = buffer & 0xFF;
    }
    return result.subarray(0, result.length - missingOctets);
  }
}

/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Button_Save() {
  RecipeScreen.OpenSavePopup();
}
export function Button_Add() {
  RecipeScreen.OpenAddPopup();
}
export function Button_Delete() {
  RecipeScreen.OpenDeletePopup();
}
export function Button_Edit() {
  RecipeScreen.OpenEditPopup();
}
export function Button_ListUp() {
  RecipeScreen.ListPrev();
}
export function Button_ListDown() {
  RecipeScreen.ListNext();
}
export function Button_Load() {
  RecipeScreen.OpenLoadPopup();
}
export function Button_Sort(asc, desc) {
  RecipeScreen.SortList(asc, desc);
}
export function Button_Filter() {
  RecipeScreen.OpenFilterPopup();
}
export function Button_Info(simple) {
  RecipeScreen.OpenInfoPopup(simple);
}
export function Event_Loaded() {
  HMIRuntime.Tags.SysFct.SetTagValue("Recipe_List_SelectedId", 0);
  HMIRuntime.Tags.SysFct.SetTagValue("Recipe_List_Page_Act", 1);
  RecipeInternal.List_FillRecipeList();
}
export function Event_Unlaoded() {
  RecipeInternal.Initialize_ResetTables();
}
