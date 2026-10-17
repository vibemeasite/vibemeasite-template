// BSA Phase 27 — fixed UI strings of the Travel Kit's calendar and trip pages.
// Owner content (trip/place text) is translated by the owner per language;
// these are the kit's own labels. Unknown locales fall back to English.

export interface TravelStrings {
  upcoming: string;
  now: string;
  past: string;
  cancelled: string;
  pastCta: string;
  book: string;
  today: string;
  prev: string;
  next: string;
  monthView: string;
  listView: string;
  noTrips: string;
  route: string;
  routeSoon: string;
  stops: string;
  arrival: string;
  duration: string;
  openInMaps: string;
  close: string;
  photos: string;
  more: string;
  calendar: string;
  start: string;
  startHint: string;
  email: string;
  sendCode: string;
  codeSent: string;
  code: string;
  verify: string;
  wrongCode: string;
  expired: string;
  tooMany: string;
  genericError: string;
  availableFrom: string;
  signedInAs: string;
  signOut: string;
  locked: string;
  nextStop: string;
  nextTeaser: string;
  unlockedNote: string;
  testNext: string;
  testAll: string;
  testReset: string;
  participantsOnly: string;
  changeEmail: string;
  audioGuide: string;
  transcript: string;
  audioAlso: string;
  offlineTitle: string;
  offlineIntro: string;
  offlineDownload: string;
  offlineSaving: string;
  offlineKeepOpen: string;
  offlinePaused: string;
  offlinePausedHint: string;
  offlineResume: string;
  offlineReady: string;
  offlineUntil: string;
  offlineNow: string;
  offlineNeedNet: string;
  offlineUpdate: string;
  offlineIosHint: string;
  offlineInstall: string;
  offlineRemove: string;
  offlineRemoveConfirm: string;
  offlineLowSpace: string;
  offlineUnsupported: string;
}

const EN: TravelStrings = {
  upcoming: "Upcoming",
  now: "Happening now",
  past: "Past",
  cancelled: "Cancelled",
  pastCta: "Past trip — see photos & stories",
  book: "Book",
  today: "Today",
  prev: "Previous",
  next: "Next",
  monthView: "Month",
  listView: "List",
  noTrips: "No trips scheduled yet.",
  route: "Route",
  routeSoon: "Route coming soon",
  stops: "Stops",
  arrival: "Arrival",
  duration: "Stay",
  openInMaps: "Open in Google Maps",
  close: "Close",
  photos: "Photos",
  more: "Read more",
  calendar: "Trip calendar",
  start: "Start the trip",
  startHint: "Participants: sign in with the email you registered with to unlock the stops as you reach them.",
  email: "Your email",
  sendCode: "Send code",
  codeSent: "We've sent a 6-digit code to",
  code: "6-digit code",
  verify: "Confirm",
  wrongCode: "That code isn't right. Attempts left:",
  expired: "The code has expired — request a new one.",
  tooMany: "Too many attempts — wait a few minutes and try again.",
  genericError: "Something went wrong. Please try again.",
  availableFrom: "Start opens on",
  signedInAs: "Signed in as",
  signOut: "Sign out",
  locked: "Locked until you reach it",
  nextStop: "Next stop",
  nextTeaser: "Coming up next",
  unlockedNote: "Stops unlock as you reach them (or at their scheduled time).",
  testNext: "Test: next stop revealed",
  testAll: "Test: all stops revealed",
  testReset: "Test: reveal reset",
  participantsOnly: "Stop details are for trip participants.",
  changeEmail: "Use another email",
  audioGuide: "Audio guide",
  transcript: "Read the text",
  audioAlso: "Also available in",
  offlineTitle: "Save the trip on this phone",
  offlineIntro: "Download once on Wi-Fi: the map, the stories and every audio guide will work without internet.",
  offlineDownload: "Download",
  offlineSaving: "Saving the trip…",
  offlineKeepOpen: "Keep this page open until it finishes.",
  offlinePaused: "Download paused",
  offlinePausedHint: "The connection dropped. Files already saved are kept.",
  offlineResume: "Continue",
  offlineReady: "Available offline",
  offlineUntil: "until",
  offlineNow: "You're offline — using the saved copy.",
  offlineNeedNet: "Connect to the internet to save this trip for offline use.",
  offlineUpdate: "Update the saved trip",
  offlineIosHint: "On iPhone: tap Share → Add to Home Screen, and open the trip from there.",
  offlineInstall: "Install as an app",
  offlineRemove: "Remove offline copy",
  offlineRemoveConfirm: "Remove the offline copy from this phone?",
  offlineLowSpace: "This phone may not have enough free space. Try anyway?",
  offlineUnsupported: "This browser can't save the trip for offline use.",
};

const TABLE: Record<string, Partial<TravelStrings>> = {
  en: EN,
  fr: {
    upcoming: "À venir", now: "En cours", past: "Passé", cancelled: "Annulé",
    pastCta: "Voyage passé — photos et récits", book: "Réserver", today: "Aujourd'hui",
    prev: "Précédent", next: "Suivant", monthView: "Mois", listView: "Liste",
    noTrips: "Aucun voyage prévu pour le moment.", route: "Itinéraire", routeSoon: "Itinéraire bientôt disponible",
    stops: "Étapes", arrival: "Arrivée", duration: "Durée", openInMaps: "Ouvrir dans Google Maps",
    close: "Fermer", photos: "Photos", more: "En savoir plus", calendar: "Calendrier des voyages",
    start: "Commencer le voyage", startHint: "Participants : connectez-vous avec le courriel de votre inscription pour débloquer les étapes à mesure que vous y arrivez.", email: "Votre courriel", sendCode: "Envoyer le code", codeSent: "Nous avons envoyé un code à 6 chiffres à", code: "Code à 6 chiffres", verify: "Confirmer", wrongCode: "Code incorrect. Essais restants :", expired: "Le code a expiré — demandez-en un nouveau.", tooMany: "Trop d'essais — attendez quelques minutes et réessayez.", genericError: "Une erreur est survenue. Veuillez réessayer.", availableFrom: "Ouverture le", signedInAs: "Connecté(e) en tant que", signOut: "Se déconnecter", locked: "Débloqué à votre arrivée", nextStop: "Prochaine étape", nextTeaser: "À venir", unlockedNote: "Les étapes se débloquent à votre arrivée (ou à l'heure prévue).", testNext: "Test : étape suivante débloquée", testAll: "Test : toutes les étapes débloquées", testReset: "Test : réinitialisé", participantsOnly: "Les détails des étapes sont réservés aux participants.", changeEmail: "Autre courriel",
    audioGuide: "Audioguide", transcript: "Lire le texte", audioAlso: "Aussi disponible en",
    offlineTitle: "Enregistrez le voyage sur ce téléphone", offlineIntro: "Téléchargez une fois en Wi-Fi : la carte, les récits et tous les audioguides fonctionneront sans Internet.", offlineDownload: "Télécharger", offlineSaving: "Enregistrement du voyage…", offlineKeepOpen: "Gardez cette page ouverte jusqu'à la fin.", offlinePaused: "Téléchargement en pause", offlinePausedHint: "La connexion a été coupée. Les fichiers déjà enregistrés sont conservés.", offlineResume: "Continuer", offlineReady: "Disponible hors ligne", offlineUntil: "jusqu'au", offlineNow: "Vous êtes hors ligne — la copie enregistrée est utilisée.", offlineNeedNet: "Connectez-vous à Internet pour enregistrer ce voyage hors ligne.", offlineUpdate: "Mettre à jour le voyage enregistré", offlineIosHint: "Sur iPhone : touchez Partager → Sur l'écran d'accueil, puis ouvrez le voyage depuis là.", offlineInstall: "Installer comme application", offlineRemove: "Supprimer la copie hors ligne", offlineRemoveConfirm: "Supprimer la copie hors ligne de ce téléphone?", offlineLowSpace: "Ce téléphone n'a peut-être pas assez d'espace. Essayer quand même?", offlineUnsupported: "Ce navigateur ne peut pas enregistrer le voyage hors ligne.",
  },
  uk: {
    upcoming: "Незабаром", now: "Триває зараз", past: "Минула", cancelled: "Скасовано",
    pastCta: "Минула поїздка — фото та історії", book: "Забронювати", today: "Сьогодні",
    prev: "Назад", next: "Далі", monthView: "Місяць", listView: "Список",
    noTrips: "Поїздок поки не заплановано.", route: "Маршрут", routeSoon: "Маршрут незабаром",
    stops: "Зупинки", arrival: "Прибуття", duration: "Тривалість", openInMaps: "Відкрити в Google Maps",
    close: "Закрити", photos: "Фото", more: "Детальніше", calendar: "Календар поїздок",
    start: "Почати поїздку", startHint: "Учасники: увійдіть з поштою, яку вказали при реєстрації, — зупинки відкриватимуться, коли ви до них доїдете.", email: "Ваша пошта", sendCode: "Надіслати код", codeSent: "Ми надіслали 6-значний код на", code: "6-значний код", verify: "Підтвердити", wrongCode: "Код неправильний. Залишилося спроб:", expired: "Термін дії коду минув — запросіть новий.", tooMany: "Забагато спроб — зачекайте кілька хвилин і спробуйте ще раз.", genericError: "Щось пішло не так. Спробуйте ще раз.", availableFrom: "Старт відкриється", signedInAs: "Ви увійшли як", signOut: "Вийти", locked: "Відкриється, коли ви доїдете", nextStop: "Наступна зупинка", nextTeaser: "Далі за маршрутом", unlockedNote: "Зупинки відкриваються, коли ви до них доїжджаєте (або в запланований час).", testNext: "Тест: відкрито наступну зупинку", testAll: "Тест: відкрито всі зупинки", testReset: "Тест: скинуто", participantsOnly: "Деталі зупинок — для учасників поїздки.", changeEmail: "Інша пошта",
    audioGuide: "Аудіогід", transcript: "Текст запису", audioAlso: "Також доступно",
    offlineTitle: "Збережіть поїздку на телефон", offlineIntro: "Завантажте один раз через Wi-Fi — карта, історії й усі аудіогіди працюватимуть без інтернету.", offlineDownload: "Завантажити", offlineSaving: "Зберігаємо поїздку…", offlineKeepOpen: "Не закривайте сторінку, доки завантаження не завершиться.", offlinePaused: "Завантаження призупинено", offlinePausedHint: "Зв'язок перервався. Уже збережені файли залишаються.", offlineResume: "Продовжити", offlineReady: "Доступно офлайн", offlineUntil: "до", offlineNow: "Ви офлайн — працює збережена копія.", offlineNeedNet: "Підключіться до інтернету, щоб зберегти поїздку для офлайн-режиму.", offlineUpdate: "Оновити збережену поїздку", offlineIosHint: "На iPhone: натисніть «Поділитися» → «На початковий екран» і відкривайте поїздку звідти.", offlineInstall: "Встановити як застосунок", offlineRemove: "Видалити офлайн-копію", offlineRemoveConfirm: "Видалити офлайн-копію з цього телефона?", offlineLowSpace: "На телефоні може бракувати місця. Спробувати все одно?", offlineUnsupported: "Цей браузер не може зберегти поїздку для офлайн-режиму.",
  },
  ru: {
    upcoming: "Скоро", now: "Идёт сейчас", past: "Прошедшая", cancelled: "Отменена",
    pastCta: "Прошедшая поездка — фото и истории", book: "Забронировать", today: "Сегодня",
    prev: "Назад", next: "Далее", monthView: "Месяц", listView: "Список",
    noTrips: "Поездок пока не запланировано.", route: "Маршрут", routeSoon: "Маршрут скоро появится",
    stops: "Остановки", arrival: "Прибытие", duration: "Длительность", openInMaps: "Открыть в Google Maps",
    close: "Закрыть", photos: "Фото", more: "Подробнее", calendar: "Календарь поездок",
    start: "Начать поездку", startHint: "Участники: войдите с почтой, указанной при регистрации, — остановки будут открываться, когда вы до них доедете.", email: "Ваша почта", sendCode: "Отправить код", codeSent: "Мы отправили 6-значный код на", code: "6-значный код", verify: "Подтвердить", wrongCode: "Код неверный. Осталось попыток:", expired: "Срок действия кода истёк — запросите новый.", tooMany: "Слишком много попыток — подождите несколько минут и попробуйте снова.", genericError: "Что-то пошло не так. Попробуйте ещё раз.", availableFrom: "Старт откроется", signedInAs: "Вы вошли как", signOut: "Выйти", locked: "Откроется, когда вы доедете", nextStop: "Следующая остановка", nextTeaser: "Далее по маршруту", unlockedNote: "Остановки открываются, когда вы до них доезжаете (или в запланированное время).", testNext: "Тест: открыта следующая остановка", testAll: "Тест: открыты все остановки", testReset: "Тест: сброшено", participantsOnly: "Подробности остановок — для участников поездки.", changeEmail: "Другая почта",
    audioGuide: "Аудиогид", transcript: "Текст записи", audioAlso: "Также доступно",
    offlineTitle: "Сохраните поездку на телефон", offlineIntro: "Скачайте один раз через Wi-Fi — карта, истории и все аудиогиды будут работать без интернета.", offlineDownload: "Скачать", offlineSaving: "Сохраняем поездку…", offlineKeepOpen: "Не закрывайте страницу, пока загрузка не завершится.", offlinePaused: "Загрузка приостановлена", offlinePausedHint: "Связь прервалась. Уже сохранённые файлы остаются.", offlineResume: "Продолжить", offlineReady: "Доступно офлайн", offlineUntil: "до", offlineNow: "Вы офлайн — работает сохранённая копия.", offlineNeedNet: "Подключитесь к интернету, чтобы сохранить поездку для офлайн-режима.", offlineUpdate: "Обновить сохранённую поездку", offlineIosHint: "На iPhone: нажмите «Поделиться» → «На экран „Домой“» и открывайте поездку оттуда.", offlineInstall: "Установить как приложение", offlineRemove: "Удалить офлайн-копию", offlineRemoveConfirm: "Удалить офлайн-копию с этого телефона?", offlineLowSpace: "На телефоне может не хватить места. Попробовать всё равно?", offlineUnsupported: "Этот браузер не может сохранить поездку для офлайн-режима.",
  },
  es: {
    upcoming: "Próximo", now: "En curso", past: "Pasado", cancelled: "Cancelado",
    pastCta: "Viaje pasado — fotos e historias", book: "Reservar", today: "Hoy",
    prev: "Anterior", next: "Siguiente", monthView: "Mes", listView: "Lista",
    noTrips: "Todavía no hay viajes programados.", route: "Ruta", routeSoon: "Ruta próximamente",
    stops: "Paradas", arrival: "Llegada", duration: "Estancia", openInMaps: "Abrir en Google Maps",
    close: "Cerrar", photos: "Fotos", more: "Leer más", calendar: "Calendario de viajes",
    start: "Empezar el viaje", startHint: "Participantes: entra con el correo con el que te inscribiste para desbloquear las paradas al llegar a ellas.", email: "Tu correo", sendCode: "Enviar código", codeSent: "Hemos enviado un código de 6 dígitos a", code: "Código de 6 dígitos", verify: "Confirmar", wrongCode: "Código incorrecto. Intentos restantes:", expired: "El código ha caducado: pide uno nuevo.", tooMany: "Demasiados intentos: espera unos minutos y vuelve a intentarlo.", genericError: "Algo salió mal. Inténtalo de nuevo.", availableFrom: "Disponible desde el", signedInAs: "Has entrado como", signOut: "Salir", locked: "Se desbloquea al llegar", nextStop: "Próxima parada", nextTeaser: "A continuación", unlockedNote: "Las paradas se desbloquean al llegar (o a la hora prevista).", testNext: "Prueba: siguiente parada desbloqueada", testAll: "Prueba: todas las paradas desbloqueadas", testReset: "Prueba: reiniciado", participantsOnly: "Los detalles de las paradas son para los participantes.", changeEmail: "Otro correo",
    audioGuide: "Audioguía", transcript: "Leer el texto", audioAlso: "También disponible en",
    offlineTitle: "Guarda el viaje en este teléfono", offlineIntro: "Descárgalo una vez con Wi-Fi: el mapa, las historias y todas las audioguías funcionarán sin internet.", offlineDownload: "Descargar", offlineSaving: "Guardando el viaje…", offlineKeepOpen: "Mantén esta página abierta hasta que termine.", offlinePaused: "Descarga en pausa", offlinePausedHint: "Se cortó la conexión. Los archivos ya guardados se conservan.", offlineResume: "Continuar", offlineReady: "Disponible sin conexión", offlineUntil: "hasta el", offlineNow: "Estás sin conexión: se usa la copia guardada.", offlineNeedNet: "Conéctate a internet para guardar este viaje sin conexión.", offlineUpdate: "Actualizar el viaje guardado", offlineIosHint: "En iPhone: toca Compartir → Añadir a pantalla de inicio y abre el viaje desde ahí.", offlineInstall: "Instalar como aplicación", offlineRemove: "Eliminar copia sin conexión", offlineRemoveConfirm: "¿Eliminar la copia sin conexión de este teléfono?", offlineLowSpace: "Puede que este teléfono no tenga espacio suficiente. ¿Intentarlo igualmente?", offlineUnsupported: "Este navegador no puede guardar el viaje sin conexión.",
  },
  de: {
    upcoming: "Demnächst", now: "Läuft gerade", past: "Vergangen", cancelled: "Abgesagt",
    pastCta: "Vergangene Reise — Fotos & Geschichten", book: "Buchen", today: "Heute",
    prev: "Zurück", next: "Weiter", monthView: "Monat", listView: "Liste",
    noTrips: "Noch keine Reisen geplant.", route: "Route", routeSoon: "Route folgt in Kürze",
    stops: "Stationen", arrival: "Ankunft", duration: "Aufenthalt", openInMaps: "In Google Maps öffnen",
    close: "Schließen", photos: "Fotos", more: "Mehr lesen", calendar: "Reisekalender",
    start: "Reise starten", startHint: "Teilnehmende: Melden Sie sich mit der E-Mail Ihrer Anmeldung an, um Stationen bei Ankunft freizuschalten.", email: "Ihre E-Mail", sendCode: "Code senden", codeSent: "Wir haben einen 6-stelligen Code gesendet an", code: "6-stelliger Code", verify: "Bestätigen", wrongCode: "Falscher Code. Verbleibende Versuche:", expired: "Der Code ist abgelaufen – fordern Sie einen neuen an.", tooMany: "Zu viele Versuche – warten Sie ein paar Minuten.", genericError: "Etwas ist schiefgelaufen. Bitte erneut versuchen.", availableFrom: "Start möglich ab", signedInAs: "Angemeldet als", signOut: "Abmelden", locked: "Wird bei Ankunft freigeschaltet", nextStop: "Nächste Station", nextTeaser: "Als Nächstes", unlockedNote: "Stationen werden bei Ankunft (oder zur geplanten Zeit) freigeschaltet.", testNext: "Test: nächste Station freigeschaltet", testAll: "Test: alle Stationen freigeschaltet", testReset: "Test: zurückgesetzt", participantsOnly: "Details der Stationen sind für Teilnehmende.", changeEmail: "Andere E-Mail",
    audioGuide: "Audioguide", transcript: "Text lesen", audioAlso: "Auch verfügbar auf",
    offlineTitle: "Reise auf diesem Handy speichern", offlineIntro: "Einmal im WLAN herunterladen: Karte, Geschichten und alle Audioguides funktionieren dann ohne Internet.", offlineDownload: "Herunterladen", offlineSaving: "Reise wird gespeichert…", offlineKeepOpen: "Lassen Sie diese Seite geöffnet, bis es fertig ist.", offlinePaused: "Download pausiert", offlinePausedHint: "Die Verbindung ist abgebrochen. Bereits gespeicherte Dateien bleiben erhalten.", offlineResume: "Fortsetzen", offlineReady: "Offline verfügbar", offlineUntil: "bis", offlineNow: "Sie sind offline – die gespeicherte Kopie wird verwendet.", offlineNeedNet: "Verbinden Sie sich mit dem Internet, um diese Reise offline zu speichern.", offlineUpdate: "Gespeicherte Reise aktualisieren", offlineIosHint: "Auf dem iPhone: Teilen → Zum Home-Bildschirm, dann die Reise von dort öffnen.", offlineInstall: "Als App installieren", offlineRemove: "Offline-Kopie entfernen", offlineRemoveConfirm: "Offline-Kopie von diesem Handy entfernen?", offlineLowSpace: "Möglicherweise ist nicht genug Speicher frei. Trotzdem versuchen?", offlineUnsupported: "Dieser Browser kann die Reise nicht offline speichern.",
  },
  it: {
    upcoming: "In arrivo", now: "In corso", past: "Passato", cancelled: "Annullato",
    pastCta: "Viaggio passato — foto e racconti", book: "Prenota", today: "Oggi",
    prev: "Precedente", next: "Successivo", monthView: "Mese", listView: "Elenco",
    noTrips: "Nessun viaggio in programma.", route: "Percorso", routeSoon: "Percorso in arrivo",
    stops: "Tappe", arrival: "Arrivo", duration: "Sosta", openInMaps: "Apri in Google Maps",
    close: "Chiudi", photos: "Foto", more: "Leggi di più", calendar: "Calendario dei viaggi",
    start: "Inizia il viaggio", startHint: "Partecipanti: accedi con l'e-mail dell'iscrizione per sbloccare le tappe quando le raggiungi.", email: "La tua e-mail", sendCode: "Invia codice", codeSent: "Abbiamo inviato un codice a 6 cifre a", code: "Codice a 6 cifre", verify: "Conferma", wrongCode: "Codice errato. Tentativi rimasti:", expired: "Il codice è scaduto: richiedine uno nuovo.", tooMany: "Troppi tentativi: attendi qualche minuto e riprova.", genericError: "Qualcosa è andato storto. Riprova.", availableFrom: "Disponibile dal", signedInAs: "Accesso come", signOut: "Esci", locked: "Si sblocca all'arrivo", nextStop: "Prossima tappa", nextTeaser: "In arrivo", unlockedNote: "Le tappe si sbloccano all'arrivo (o all'ora prevista).", testNext: "Test: tappa successiva sbloccata", testAll: "Test: tutte le tappe sbloccate", testReset: "Test: azzerato", participantsOnly: "I dettagli delle tappe sono per i partecipanti.", changeEmail: "Altra e-mail",
    audioGuide: "Audioguida", transcript: "Leggi il testo", audioAlso: "Disponibile anche in",
    offlineTitle: "Salva il viaggio su questo telefono", offlineIntro: "Scaricalo una volta con il Wi-Fi: mappa, racconti e tutte le audioguide funzioneranno senza internet.", offlineDownload: "Scarica", offlineSaving: "Salvataggio del viaggio…", offlineKeepOpen: "Tieni aperta questa pagina finché non finisce.", offlinePaused: "Download in pausa", offlinePausedHint: "La connessione si è interrotta. I file già salvati restano.", offlineResume: "Continua", offlineReady: "Disponibile offline", offlineUntil: "fino al", offlineNow: "Sei offline: viene usata la copia salvata.", offlineNeedNet: "Connettiti a internet per salvare questo viaggio offline.", offlineUpdate: "Aggiorna il viaggio salvato", offlineIosHint: "Su iPhone: tocca Condividi → Aggiungi alla schermata Home e apri il viaggio da lì.", offlineInstall: "Installa come app", offlineRemove: "Rimuovi la copia offline", offlineRemoveConfirm: "Rimuovere la copia offline da questo telefono?", offlineLowSpace: "Il telefono potrebbe non avere abbastanza spazio. Provare comunque?", offlineUnsupported: "Questo browser non può salvare il viaggio offline.",
  },
  pt: {
    upcoming: "Em breve", now: "A decorrer", past: "Passada", cancelled: "Cancelada",
    pastCta: "Viagem passada — fotos e histórias", book: "Reservar", today: "Hoje",
    prev: "Anterior", next: "Seguinte", monthView: "Mês", listView: "Lista",
    noTrips: "Ainda não há viagens agendadas.", route: "Percurso", routeSoon: "Percurso em breve",
    stops: "Paragens", arrival: "Chegada", duration: "Estadia", openInMaps: "Abrir no Google Maps",
    close: "Fechar", photos: "Fotos", more: "Ler mais", calendar: "Calendário de viagens",
    start: "Começar a viagem", startHint: "Participantes: entre com o e-mail da inscrição para desbloquear as paragens quando lá chegar.", email: "O seu e-mail", sendCode: "Enviar código", codeSent: "Enviámos um código de 6 dígitos para", code: "Código de 6 dígitos", verify: "Confirmar", wrongCode: "Código incorreto. Tentativas restantes:", expired: "O código expirou — peça um novo.", tooMany: "Demasiadas tentativas — aguarde alguns minutos.", genericError: "Algo correu mal. Tente novamente.", availableFrom: "Disponível a partir de", signedInAs: "Sessão iniciada como", signOut: "Sair", locked: "Desbloqueia quando chegar", nextStop: "Próxima paragem", nextTeaser: "A seguir", unlockedNote: "As paragens desbloqueiam quando chega (ou à hora prevista).", testNext: "Teste: paragem seguinte desbloqueada", testAll: "Teste: todas as paragens desbloqueadas", testReset: "Teste: reposto", participantsOnly: "Os detalhes das paragens são para participantes.", changeEmail: "Outro e-mail",
    audioGuide: "Audioguia", transcript: "Ler o texto", audioAlso: "Também disponível em",
    offlineTitle: "Guarde a viagem neste telemóvel", offlineIntro: "Descarregue uma vez com Wi-Fi: o mapa, as histórias e todos os audioguias funcionam sem internet.", offlineDownload: "Descarregar", offlineSaving: "A guardar a viagem…", offlineKeepOpen: "Mantenha esta página aberta até terminar.", offlinePaused: "Descarga em pausa", offlinePausedHint: "A ligação caiu. Os ficheiros já guardados mantêm-se.", offlineResume: "Continuar", offlineReady: "Disponível offline", offlineUntil: "até", offlineNow: "Está offline — a usar a cópia guardada.", offlineNeedNet: "Ligue-se à internet para guardar esta viagem offline.", offlineUpdate: "Atualizar a viagem guardada", offlineIosHint: "No iPhone: toque em Partilhar → Adicionar ao ecrã principal e abra a viagem a partir daí.", offlineInstall: "Instalar como app", offlineRemove: "Remover cópia offline", offlineRemoveConfirm: "Remover a cópia offline deste telemóvel?", offlineLowSpace: "O telemóvel pode não ter espaço suficiente. Tentar mesmo assim?", offlineUnsupported: "Este navegador não consegue guardar a viagem offline.",
  },
  pl: {
    upcoming: "Wkrótce", now: "Trwa teraz", past: "Zakończona", cancelled: "Odwołana",
    pastCta: "Zakończona wycieczka — zdjęcia i relacje", book: "Zarezerwuj", today: "Dziś",
    prev: "Poprzedni", next: "Następny", monthView: "Miesiąc", listView: "Lista",
    noTrips: "Brak zaplanowanych wycieczek.", route: "Trasa", routeSoon: "Trasa wkrótce",
    stops: "Przystanki", arrival: "Przyjazd", duration: "Pobyt", openInMaps: "Otwórz w Mapach Google",
    close: "Zamknij", photos: "Zdjęcia", more: "Czytaj więcej", calendar: "Kalendarz wycieczek",
    start: "Rozpocznij wycieczkę", startHint: "Uczestnicy: zaloguj się e-mailem podanym przy zapisie, aby odblokowywać przystanki po dotarciu.", email: "Twój e-mail", sendCode: "Wyślij kod", codeSent: "Wysłaliśmy 6-cyfrowy kod na", code: "6-cyfrowy kod", verify: "Potwierdź", wrongCode: "Nieprawidłowy kod. Pozostałe próby:", expired: "Kod wygasł — poproś o nowy.", tooMany: "Zbyt wiele prób — odczekaj kilka minut.", genericError: "Coś poszło nie tak. Spróbuj ponownie.", availableFrom: "Start dostępny od", signedInAs: "Zalogowano jako", signOut: "Wyloguj", locked: "Odblokuje się po dotarciu", nextStop: "Następny przystanek", nextTeaser: "Dalej na trasie", unlockedNote: "Przystanki odblokowują się po dotarciu (lub o planowanej godzinie).", testNext: "Test: odblokowano następny przystanek", testAll: "Test: odblokowano wszystkie przystanki", testReset: "Test: zresetowano", participantsOnly: "Szczegóły przystanków są dla uczestników.", changeEmail: "Inny e-mail",
    audioGuide: "Audioprzewodnik", transcript: "Przeczytaj tekst", audioAlso: "Dostępne także w",
    offlineTitle: "Zapisz wycieczkę w telefonie", offlineIntro: "Pobierz raz przez Wi-Fi: mapa, opowieści i wszystkie audioprzewodniki zadziałają bez internetu.", offlineDownload: "Pobierz", offlineSaving: "Zapisywanie wycieczki…", offlineKeepOpen: "Nie zamykaj tej strony do końca pobierania.", offlinePaused: "Pobieranie wstrzymane", offlinePausedHint: "Połączenie zostało przerwane. Zapisane pliki zostają.", offlineResume: "Kontynuuj", offlineReady: "Dostępne offline", offlineUntil: "do", offlineNow: "Jesteś offline — używana jest zapisana kopia.", offlineNeedNet: "Połącz się z internetem, aby zapisać wycieczkę offline.", offlineUpdate: "Zaktualizuj zapisaną wycieczkę", offlineIosHint: "Na iPhonie: Udostępnij → Do ekranu początkowego i otwieraj wycieczkę stamtąd.", offlineInstall: "Zainstaluj jako aplikację", offlineRemove: "Usuń kopię offline", offlineRemoveConfirm: "Usunąć kopię offline z tego telefonu?", offlineLowSpace: "W telefonie może brakować miejsca. Spróbować mimo to?", offlineUnsupported: "Ta przeglądarka nie może zapisać wycieczki offline.",
  },
};

export function travelStrings(locale: string): TravelStrings {
  const base = (locale || "en").toLowerCase().split("-")[0];
  return { ...EN, ...(TABLE[base] ?? {}) };
}
