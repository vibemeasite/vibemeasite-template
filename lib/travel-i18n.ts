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
  },
  uk: {
    upcoming: "Незабаром", now: "Триває зараз", past: "Минула", cancelled: "Скасовано",
    pastCta: "Минула поїздка — фото та історії", book: "Забронювати", today: "Сьогодні",
    prev: "Назад", next: "Далі", monthView: "Місяць", listView: "Список",
    noTrips: "Поїздок поки не заплановано.", route: "Маршрут", routeSoon: "Маршрут незабаром",
    stops: "Зупинки", arrival: "Прибуття", duration: "Тривалість", openInMaps: "Відкрити в Google Maps",
    close: "Закрити", photos: "Фото", more: "Детальніше", calendar: "Календар поїздок",
  },
  ru: {
    upcoming: "Скоро", now: "Идёт сейчас", past: "Прошедшая", cancelled: "Отменена",
    pastCta: "Прошедшая поездка — фото и истории", book: "Забронировать", today: "Сегодня",
    prev: "Назад", next: "Далее", monthView: "Месяц", listView: "Список",
    noTrips: "Поездок пока не запланировано.", route: "Маршрут", routeSoon: "Маршрут скоро появится",
    stops: "Остановки", arrival: "Прибытие", duration: "Длительность", openInMaps: "Открыть в Google Maps",
    close: "Закрыть", photos: "Фото", more: "Подробнее", calendar: "Календарь поездок",
  },
  es: {
    upcoming: "Próximo", now: "En curso", past: "Pasado", cancelled: "Cancelado",
    pastCta: "Viaje pasado — fotos e historias", book: "Reservar", today: "Hoy",
    prev: "Anterior", next: "Siguiente", monthView: "Mes", listView: "Lista",
    noTrips: "Todavía no hay viajes programados.", route: "Ruta", routeSoon: "Ruta próximamente",
    stops: "Paradas", arrival: "Llegada", duration: "Estancia", openInMaps: "Abrir en Google Maps",
    close: "Cerrar", photos: "Fotos", more: "Leer más", calendar: "Calendario de viajes",
  },
  de: {
    upcoming: "Demnächst", now: "Läuft gerade", past: "Vergangen", cancelled: "Abgesagt",
    pastCta: "Vergangene Reise — Fotos & Geschichten", book: "Buchen", today: "Heute",
    prev: "Zurück", next: "Weiter", monthView: "Monat", listView: "Liste",
    noTrips: "Noch keine Reisen geplant.", route: "Route", routeSoon: "Route folgt in Kürze",
    stops: "Stationen", arrival: "Ankunft", duration: "Aufenthalt", openInMaps: "In Google Maps öffnen",
    close: "Schließen", photos: "Fotos", more: "Mehr lesen", calendar: "Reisekalender",
  },
  it: {
    upcoming: "In arrivo", now: "In corso", past: "Passato", cancelled: "Annullato",
    pastCta: "Viaggio passato — foto e racconti", book: "Prenota", today: "Oggi",
    prev: "Precedente", next: "Successivo", monthView: "Mese", listView: "Elenco",
    noTrips: "Nessun viaggio in programma.", route: "Percorso", routeSoon: "Percorso in arrivo",
    stops: "Tappe", arrival: "Arrivo", duration: "Sosta", openInMaps: "Apri in Google Maps",
    close: "Chiudi", photos: "Foto", more: "Leggi di più", calendar: "Calendario dei viaggi",
  },
  pt: {
    upcoming: "Em breve", now: "A decorrer", past: "Passada", cancelled: "Cancelada",
    pastCta: "Viagem passada — fotos e histórias", book: "Reservar", today: "Hoje",
    prev: "Anterior", next: "Seguinte", monthView: "Mês", listView: "Lista",
    noTrips: "Ainda não há viagens agendadas.", route: "Percurso", routeSoon: "Percurso em breve",
    stops: "Paragens", arrival: "Chegada", duration: "Estadia", openInMaps: "Abrir no Google Maps",
    close: "Fechar", photos: "Fotos", more: "Ler mais", calendar: "Calendário de viagens",
  },
  pl: {
    upcoming: "Wkrótce", now: "Trwa teraz", past: "Zakończona", cancelled: "Odwołana",
    pastCta: "Zakończona wycieczka — zdjęcia i relacje", book: "Zarezerwuj", today: "Dziś",
    prev: "Poprzedni", next: "Następny", monthView: "Miesiąc", listView: "Lista",
    noTrips: "Brak zaplanowanych wycieczek.", route: "Trasa", routeSoon: "Trasa wkrótce",
    stops: "Przystanki", arrival: "Przyjazd", duration: "Pobyt", openInMaps: "Otwórz w Mapach Google",
    close: "Zamknij", photos: "Zdjęcia", more: "Czytaj więcej", calendar: "Kalendarz wycieczek",
  },
};

export function travelStrings(locale: string): TravelStrings {
  const base = (locale || "en").toLowerCase().split("-")[0];
  return { ...EN, ...(TABLE[base] ?? {}) };
}
