import { useState, useEffect, useCallback } from "react";
import type { Patient, SessionRecord, Screen } from "../types";
import { subscribePatients, subscribeSessions, seedIfEmpty } from "../db";

export function useAppState() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [currentScreen, setCurrentScreen] = useState<Screen>("dashboard");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedIfEmpty();
    
    const unsubPatients = subscribePatients((data) => {
      setPatients(data);
      setLoading(false);
    });
    
    const unsubSessions = subscribeSessions(setSessions);
    
    return () => {
      unsubPatients();
      unsubSessions();
    };
  }, []);

  const navigateTo = useCallback((screen: Screen, patient?: Patient) => {
    setCurrentScreen(screen);
    if (patient) setSelectedPatient(patient);
  }, []);

  return {
    patients,
    sessions,
    currentScreen,
    selectedPatient,
    loading,
    setPatients,
    setSessions,
    setSelectedPatient,
    navigateTo,
  };
}
