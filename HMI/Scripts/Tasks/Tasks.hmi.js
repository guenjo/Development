
const TasksIntern = {
  /**
   * Merker Benutzername für den Wechsel das Benutzers
   *
   * @type {string}
   */
  lastUserName: '---',

  /**
   * Zähler für den iTouch
   *
   * @type {string}
   */
  lastiTouchCounter: 0,

  /**
   * iTouch-Zähler wurde initialisiert
   *
   * @type {string}
   */
  touchCounterInit: false,  

  /**
   * Timer für das Erzeugen der Input-Message
   *
   * @type {string}
   */
  timer: 0,

  /**
   * Berechnet das Datum der Zeitumstellung
   * 
   * @param user - Benutzer der die Eingabe vorgenommen hat
   * @param group - Gruppen des Wertes
   * @param name - Name des Wertes
   * @param num - Subnum des Wertes
   * @param value - Neuer Wert
   * @param isTempZone - Zone oder Set
   * @returns {void}
   */
  CreateInputMessage: function(user, group, name, num, value, isTempZone) {
    if (this.timer > 0) {
      HMIRuntime.Timers.ClearTimeout(this.timer);
      this.timer = 0;
    }
    
    this.timer = HMIRuntime.Timers.SetTimeout(DoWork, 2000);
    let _this = this;

    function DoWork() {
      _this.timer = 0;
      let nameTextList = isTempZone ? HMIRuntime.Resources.TextLists("@Default.Zones") : HMIRuntime.Resources.TextLists("@Default.Indications");
  
      HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
        HMIRuntime.Resources.TextLists("@Default.MessageText").Item(19),
        user,
        group,
        HMIRuntime.Resources.TextLists("@Default.Groups"),
        name,
        nameTextList,
        num,
        HMIRuntime.Resources.TextLists("@Default.ID"),
        value
      );
    }
  },
  
  /**
   * Wertet das Drehen des iTouch aus
   * 
   * @returns {void}
   */
  iTouchCounter: function() {  
    let ts = Tags.CreateTagSet(["DB_Unified_iTouch_Counter", "FocusCounter", "FocusMax", "FocusEditShow", "FocusEditTag", "DB_User_CurrentUser_Name", "DB_General_Para.MirrorInverted"]);
    ts.Read();
  
    let iTouchCounter = ts[0].Value;
    let focusCounter = ts[1].Value;
    let focusMax = ts[2].Value;
    let focusEditShow = ts[3].Value;
    let focusEditTag = ts[4].Value;
    let user = ts[5].Value;
    let mirrorInverted = ts[6].Value;
  
    let uIntMax = 65535;
    let diff = iTouchCounter - this.lastiTouchCounter;
  
    if (diff > uIntMax / 2) { diff -= uIntMax + 1; }
    if (diff < -1 * uIntMax / 2) { diff += uIntMax + 1; }
  
    if (diff != 0 && this.touchCounterInit) {
      if (focusEditShow) {
        let valueTag = focusEditTag + ".SetValue";
        let decTag = focusEditTag + ".Dec";
        let groupTag = focusEditTag + ".Group";
        let nameTag = focusEditTag + ".Name";
        let numTag = focusEditTag + ".SubNum";
        let stepTag = focusEditTag + ".Step";
  
        let ts = Tags.CreateTagSet([valueTag, decTag, groupTag, nameTag, numTag, stepTag]);
        ts.Read();
    
        let value = ts[0].Value;
        let dec = ts[1].Value;
        let group = ts[2].Value;
        let name = ts[3].Value;
        let num = ts[4].Value;
        let step = ts[5].Value;
        
        if (Math.abs(diff) > 2 && step > 0) {
          value += diff * step;
        } else {
          value += diff / Math.pow(10, dec);
        }
  
        Tags(valueTag).Write(value);
        this.CreateInputMessage(user, group, name, num, value, valueTag.includes("TempZone"));
  
      } else {
  
        if (mirrorInverted) {
          focusCounter += diff;
        } else {
          focusCounter -= diff;
        }
  
        if (focusCounter < 0) { focusCounter = focusMax; }
        if (focusCounter > focusMax) { focusCounter = 0; }
        
        Tags("FocusCounter").Write(focusCounter);
      }  
    }
    
    this.lastiTouchCounter = iTouchCounter;
    this.touchCounterInit = true;
  },

  /**
   * Wertet das Drücken des iTouch aus
   * 
   * @returns {void}
   */
  iTouchEnter: function() {
    let ts = Tags.CreateTagSet(["DB_Unified_iTouch_Enter", "FocusEditShow"]);
    ts.Read();
  
    let iTouchEnter = ts[0].Value;
    let focusEditShow = ts[1].Value;
  
    if (iTouchEnter) {
      Tags("FocusEditShow").Write(!focusEditShow);
    }
  },

  /**
   * Systemmeldung wenn der AUS-Taster gedrückt wurde
   * 
   * @returns {void}
   */
  OffButtonChanged: function() {
    let ts = Tags.CreateTagSet(["DB_Unified_MessageButtons_States_Off", "DB_User_CurrentUser_Name"]);
    ts.Read();
  
    let state = ts[0].Value;
    let userName = ts[1].Value;
  
    if (state) {
      HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
        HMIRuntime.Resources.TextLists("@Default.MessageText").Item(1),
        userName,
        210,
        HMIRuntime.Resources.TextLists("@Default.Groups"),
        69,
        HMIRuntime.Resources.TextLists("@Default.States")
      );
    }
  },

  /**
   * Systemmeldung wenn der EIN-Taster gedrückt wurde
   * 
   * @returns {void}
   */
  OnButtonChanged: function() {
    let ts = Tags.CreateTagSet(["DB_Unified_MessageButtons_States_On", "DB_User_CurrentUser_Name"]);
    ts.Read();
  
    let state = ts[0].Value;
    let userName = ts[1].Value;
  
    if (state) {
      HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
        HMIRuntime.Resources.TextLists("@Default.MessageText").Item(1),
        userName,
        210,
        HMIRuntime.Resources.TextLists("@Default.Groups"),
        70,
        HMIRuntime.Resources.TextLists("@Default.States")
      );
    }
  },

  /**
   * Findet das Datum der Zeitumstellung
   * 
   * @returns {void}
   */
  TimeZoneFindSwitchDate: function(year, month) {
    // Set the starting date
    let baseDate = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
    let changeDay = 0;
    let changeMinute = -1;
    let baseOffset = -1 * baseDate.getTimezoneOffset() / 60;
  
    // Loop to find the exact day a timezone adjust occurs
    for (let day = 0; day < 50; day++) {
      let tmpDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      let tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
  
      // Check if the timezone changed from one day to the next
      if (tmpOffset != baseOffset) {
        let minutes = 0;
        changeDay = day;
  
        // Back-up one day and grap the offset
        tmpDate = new Date(Date.UTC(year, month, day-1, 0, 0, 0, 0));
        tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
  
        // Count the minutes until a timezone change occurs
        while (changeMinute == -1) {
          tmpDate = new Date(Date.UTC(year, month, day-1, 0, minutes, 0, 0));
          tmpOffset = -1 * tmpDate.getTimezoneOffset() / 60;
  
          // Determine the exact minute a timezone change
          // occurs
          if (tmpOffset != baseOffset)
          {
              // Back-up a minute to get the date/time just
              // before a timezone change occurs
              tmpOffset = new Date(Date.UTC(year, month, day-1, 0, minutes-1, 0, 0));
              changeMinute = minutes;
              break;
          }
          else
              minutes++;
        }
  
        // Capture the time stamp
        tmpDate = new Date(Date.UTC(year, month, day-1, 0, minutes, 0, 0));
  
        return tmpDate;
      }
    }
  },

  /**
   * Berechnet das Datum der Zeitumstellung
   * 
   * @returns {void}
   */
  TimeZoneSetSwitchDates: function() {
    if (Tags("DB_Unified_Watchdog_HMIConnected").Read()) {
      let year = new Date().getYear();
      if (year < 1000) {
        year += 1900;
      }
    
      let firstSwitch = 0;
      let secondSwitch = 0;
      let lastOffset = 99;
    
      // Loop through every month of the current year
      for (let i = 0; i < 12; i++) {
        // Fetch the timezone value for the month
        let newDate = new Date(Date.UTC(year, i, 0, 0, 0, 0, 0));
        let tz = -1 * newDate.getTimezoneOffset() / 60;
    
        // Capture when a timzezone change occurs
        if (tz > lastOffset)
            firstSwitch = i-1;
        else if (tz < lastOffset)
            secondSwitch = i-1;
    
        lastOffset = tz;
      }
    
      // Go figure out date/time occurrences a minute before
      // a DST adjustment occurs
      let secondDstDate = this.TimeZoneFindSwitchDate(year, secondSwitch);
      let firstDstDate = this.TimeZoneFindSwitchDate(year, firstSwitch);
    
      let bias = 0;
      let daylightBias = 0;
      let daylightStartMonth = 0;
      let daylightStartWeek = 0;
      let daylightStartWeekday = 0;
      let daylightStartHour = 0;
      let daylightStartMinute = 0;
      let standardStartMonth = 0;
      let standardStartWeek = 0;
      let standardStartWeekday = 0;
      let standardStartHour = 0;
      let standardStartMinute = 0;
    
      if (firstDstDate != null && secondDstDate != null) {
        HMIRuntime.Trace("TimeZone.Daylight: " + firstDstDate);
        HMIRuntime.Trace("TimeZone.Standard: " + secondDstDate);
    
        bias = - secondDstDate.getTimezoneOffset();
        daylightBias = secondDstDate.getTimezoneOffset() - firstDstDate.getTimezoneOffset();
    
        daylightStartMonth = firstDstDate.getMonth() + 1;
        daylightStartWeek = Math.ceil(firstDstDate.getDate() / 7);
        daylightStartWeekday = firstDstDate.getDay() + 1;
        daylightStartHour = firstDstDate.getHours();
        daylightStartMinute = firstDstDate.getMinutes();
    
        standardStartMonth = secondDstDate.getMonth() + 1;
        standardStartWeek = Math.ceil(secondDstDate.getDate() / 7);
        standardStartWeekday = secondDstDate.getDay() + 1;
        standardStartHour = secondDstDate.getHours();
        standardStartMinute = secondDstDate.getMinutes();
      } else {
        bias = - new Date().getTimezoneOffset();
      }
    
      HMIRuntime.Trace("TimeZone.Bias: " + bias);
      HMIRuntime.Trace("TimeZone.DaylightBias: " + daylightBias);
      HMIRuntime.Trace("TimeZone.DaylightStartMonth: " + daylightStartMonth);
      HMIRuntime.Trace("TimeZone.DaylightStartWeek: " + daylightStartWeek);
      HMIRuntime.Trace("TimeZone.DaylightStartWeekday: " + daylightStartWeekday);
      HMIRuntime.Trace("TimeZone.DaylightStartHour: " + daylightStartHour);
      HMIRuntime.Trace("TimeZone.DaylightStartMinute: " + daylightStartMinute);
      HMIRuntime.Trace("TimeZone.StandardStartMonth: " + standardStartMonth);
      HMIRuntime.Trace("TimeZone.StandardStartWeek: " + standardStartWeek);
      HMIRuntime.Trace("TimeZone.StandardStartWeekday: " + standardStartWeekday);
      HMIRuntime.Trace("TimeZone.StandardStartHour: " + standardStartHour);
      HMIRuntime.Trace("TimeZone.StandardStartMinute: " + standardStartMinute);
    
      Tags.CreateTagSet([
        ["DB_Unified_TimeZone_Rule_Bias", bias],
        ["DB_Unified_TimeZone_Rule_DaylightBias", daylightBias],
        ["DB_Unified_TimeZone_Rule_DaylightStartMonth", daylightStartMonth],
        ["DB_Unified_TimeZone_Rule_DaylightStartWeek", daylightStartWeek],
        ["DB_Unified_TimeZone_Rule_DaylightStartWeekday", daylightStartWeekday],
        ["DB_Unified_TimeZone_Rule_DaylightStartHour", daylightStartHour],
        ["DB_Unified_TimeZone_Rule_DaylightStartMinute", daylightStartMinute],
        ["DB_Unified_TimeZone_Rule_StandardStartMonth", standardStartMonth],
        ["DB_Unified_TimeZone_Rule_StandardStartWeek", standardStartWeek],
        ["DB_Unified_TimeZone_Rule_StandardStartWeekday", standardStartWeekday],
        ["DB_Unified_TimeZone_Rule_StandardStartHour", standardStartHour],
        ["DB_Unified_TimeZone_Rule_StandardStartMinute", standardStartMinute]
      ]).Write();
    
      HMIRuntime.Timers.SetTimeout(() => Tags("DB_Unified_TimeZone_Execute").Write(true) ,1000);
    }
  },  

   /**
   * Systemmeldung wenn der Bentzer gewechselt wurde
   * 
   * @returns {void}
   */
  UserChanged: function() {
    let ts = Tags.CreateTagSet(["DB_User_CurrentUser_Name", "DB_User_CurrentUser_Level"]);
    ts.Read();
  
    let userName = ts[0].Value;
    let userLevel = ts[1].Value;
    let userNameQual = ts[0].QualityCode;
  
    if (userNameQual == 192) { //192 = QualityCode OK
      if (this.lastUserName != userName) {
        this.lastUserName = userName;
        if (userLevel > 1) {
          HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
            HMIRuntime.Resources.TextLists("@Default.MessageText").Item(5),
            userName
          );
        } else {
          HMIRuntime.Alarming.SysFct.CreateOperatorInputInformation(
            HMIRuntime.Resources.TextLists("@Default.MessageText").Item(6),
            '---'
          );
        }
      }
    }
  },

  /**
   * Alarm-Watchdog
   * 
   * @returns {void}
   */
  Watchdog: function() {
   // Tags("DB_Unified_Watchdog_Counter").Write(Tags("DB_Unified_Watchdog_Counter").Read() + 1);
    Tags("DB_Unified_Watchdog_Counter").Write(new Date());
  },
}

/*<auto-generated>
***End of Global definition area***
Changes to this comment may cause incorrect behavior during document based import.
</auto-generated>*/
export function Task_iTouchCounter() {  
  TasksIntern.iTouchCounter();
}
export function Task_iTouchEnter() {
  TasksIntern.iTouchEnter();
}
export function Task_Watchdog() {
  TasksIntern.Watchdog();
}
export function Task_OnButton() {
  TasksIntern.OnButtonChanged();
}
export function Task_OffButton() {
  TasksIntern.OffButtonChanged();
}
export function Task_CurrentUser() {
  TasksIntern.UserChanged();
}
export function Task_HMIConnected() {
  TasksIntern.TimeZoneSetSwitchDates();
}
