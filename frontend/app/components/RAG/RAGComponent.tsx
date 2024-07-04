"use client";

import React, { useState, useEffect, use } from "react";
import { SettingsConfiguration } from "../Settings/types";
import RAGConfigComponent from "./RAGConfigComponent";
import { RAGConfig, ConsoleMessage, ImportResponse } from "./types";
import { FaFileImport } from "react-icons/fa";
import { MdCancel } from "react-icons/md";

import { getImportWebSocketApiHost } from "./util";

import PulseLoader from "react-spinners/PulseLoader";
import { Settings } from "../Settings/types";

import { processFiles } from "./util";

interface RAGComponentProps {
  settingConfig: SettingsConfiguration;
  APIHost: string | null;
  RAGConfig: RAGConfig | null;
  setRAGConfig: (r_: RAGConfig | null) => void;
  showComponents: string[];
  buttonTitle: string;
  settingTemplate: string;
  baseSetting: Settings;
  setCurrentPage: (p: any) => void;
}

const RAGComponent: React.FC<RAGComponentProps> = ({
  APIHost,
  setCurrentPage,
  settingConfig,
  RAGConfig,
  setRAGConfig,
  showComponents,
  buttonTitle,
  baseSetting,
  settingTemplate,
}) => {
  const [currentRAGSettings, setCurrentRAGSettings] = useState<RAGConfig>(
    JSON.parse(JSON.stringify(RAGConfig))
  );
  const [files, setFiles] = useState<FileList | null>(null);
  const [textValues, setTextValues] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [reconnect, setReconnect] = useState(false);

  const [consoleLog, setConsoleLog] = useState<ConsoleMessage[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    setReconnect(true);
  }, []);

  // Setup Import WebSocket and messages
  useEffect(() => {
    const socketHost = getImportWebSocketApiHost();
    const localSocket = new WebSocket(socketHost);

    localSocket.onopen = () => {
      console.log("Import WebSocket connection opened to " + socketHost);
      addToConsole("INFO", "Ready for data import");
    };

    localSocket.onmessage = (event) => {
      let data;

      const timestamp = new Date().toLocaleString();
      console.log("AAAH I GOT MEESAGGGE at " + timestamp);

      try {
        data = JSON.parse(event.data);
      } catch (e) {
        console.error("Received data is not valid JSON:", event.data);
        return;
      }
      if (data.type === "STOP") {
        setIsFetching(false);
      } else {
        setConsoleLog((oldItems) => [...oldItems, data]);
      }
    };

    localSocket.onerror = (error) => {
      console.error("Import WebSocket Error:", error);
    };

    localSocket.onclose = (event) => {
      if (event.wasClean) {
        console.log(
          `Import WebSocket connection closed cleanly, code=${event.code}, reason=${event.reason}`
        );
        addToConsole("INFO", "Connection closed");
      } else {
        console.error("WebSocket connection died");
      }
    };

    setSocket(localSocket);

    return () => {
      if (localSocket.readyState !== WebSocket.CLOSED) {
        localSocket.close();
      }
    };
  }, [reconnect]);

  const saveSettings = () => {
    setRAGConfig(currentRAGSettings);
    if (buttonTitle === "Import") {
      importData();
    } else {
      importConfig();
      setCurrentPage("CHAT");
    }
  };

  const importData = async () => {
    setIsFetching(true);

    if (!files && textValues.length <= 0) {
      setIsFetching(false);
      return;
    }

    try {
      addToConsole("INFO", "Starting Import");
      const fileData = files ? await processFiles(files) : [];
      setFiles(null);
      if (fileData) {
        const payload = {
          config: {
            RAG: currentRAGSettings,
            SETTING: { selectedTheme: settingTemplate, themes: baseSetting },
          },
          data: fileData,
          textValues: textValues,
        };

        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(payload));
        } else {
          console.error(
            "WebSocket is not open. ReadyState:",
            socket?.readyState
          );
          setIsFetching(false);
          addToConsole(
            "WARNING",
            "Lost connection to backend, trying to reconnect..."
          );
          setReconnect((prevState) => !prevState);
        }
      }
    } catch (error) {
      console.error("Failed to fetch from API:", error);
      setIsFetching(false);
    }
  };

  const importConfig = async () => {
    if (!APIHost) {
      return;
    }

    setIsFetching(true);

    try {
      const payload = {
        config: {
          RAG: currentRAGSettings,
          SETTING: { selectedTheme: settingTemplate, themes: baseSetting },
        },
      };

      const response = await fetch(APIHost + "/api/set_config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: ImportResponse = await response.json();

      if (data) {
        console.log(data);
        setIsFetching(false);
      } else {
        setIsFetching(false);
      }
    } catch (error) {
      console.error("Failed to fetch from API:", error);
      setIsFetching(false);
    }
  };

  const resetSettings = () => {
    setCurrentRAGSettings(JSON.parse(JSON.stringify(RAGConfig)));
    setConsoleLog([]);
    setTextValues([]);
    setFiles(null);
  };

  const addToConsole = (
    t: "INFO" | "WARNING" | "SUCCESS" | "ERROR",
    m: string
  ) => {
    const consoleMsg: ConsoleMessage = { type: t, message: m };
    setConsoleLog((oldItems) => [...oldItems, consoleMsg]);
  };

  return (
    <div className="flex sm:flex-col md:flex-row justify-between gap-3 ">
      {currentRAGSettings &&
        Object.entries(currentRAGSettings).map(
          ([key, value]) =>
            showComponents.includes(key) && (
              <div key={"RAGButton_" + key} className="w-full md:w-1/4">
                <RAGConfigComponent
                  textValues={textValues}
                  setTextValues={setTextValues}
                  key={key}
                  files={files}
                  setFiles={setFiles}
                  settingConfig={settingConfig}
                  APIHost={APIHost}
                  RAGConfig={currentRAGSettings}
                  RAGConfigTitle={key}
                  RAGComponents={value}
                  setRAGConfig={setCurrentRAGSettings}
                />
              </div>
            )
        )}
      {currentRAGSettings ? (
        <div className="flex flex-col gap-2 w-full md:w-1/4 items-end">
          <div className="flex flex-row gap-2 w-full">
            <button
              disabled={isFetching}
              onClick={saveSettings}
              className="btn w-1/2 btn-lg text-base flex gap-2 bg-secondary-verba hover:bg-button-hover-verba text-text-verba"
            >
              {isFetching ? (
                <div>
                  <div className="flex items-center">
                    <PulseLoader
                      color={
                        settingConfig.Customization.settings.text_color.color
                      }
                      loading={true}
                      size={10}
                      speedMultiplier={0.75}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-center justify-center">
                  <FaFileImport />
                  {buttonTitle}
                  {files && <p className="text-sm">({files.length})</p>}
                </div>
              )}
            </button>
            <button
              disabled={isFetching}
              onClick={resetSettings}
              className="btn w-1/2 btn-lg text-base text-text-verba bg-warning-verba hover:bg-button-hover-verba"
            >
              <MdCancel />
              Clear
            </button>
          </div>
          {buttonTitle === "Import" && consoleLog.length > 0 && (
            <div className="bg-bg-console-verba h-[58vh] overflow-auto w-full p-5 flex flex-col gap-1 rounded-lg">
              {consoleLog &&
                consoleLog.map((msg, index) => (
                  <pre
                    key={"console_message_" + index}
                    className={`text-xs font-mono ${msg.type === "INFO" ? "text-text-console-verba" : msg.type === "WARNING" ? "text-primary-verba" : msg.type === "SUCCESS" ? "text-secondary-verba" : msg.type === "ERROR" ? "text-warning-verba" : ""}`}
                  >
                    <code>
                      ({msg.type}) {msg.message}
                    </code>
                  </pre>
                ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center">
            <PulseLoader
              color={settingConfig.Customization.settings.text_color.color}
              loading={true}
              size={10}
              speedMultiplier={0.75}
            />
            <p>Loading Components...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGComponent;
