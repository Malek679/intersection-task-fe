import React, { useState, useEffect, useRef } from 'react';
import '../App.css';

const colors = {
    GREEN: 'green',
    RED: 'red',
    YELLOW: 'yellow',
    OUTGOING: 'blue'
};

const laneWidth = 20;      // szerokość pasa
const roadLength = 250;    // odległość od środka canvasa do punktu startowego drogi przychodzącej
const outgoingLength = 250; // długość drogi wylotowej

// Zamienia kierunek na wektor (x, y)
function directionVector(direction) {
    switch (direction) {
        case 'NORTH': return { x: 0, y: -1 };
        case 'SOUTH': return { x: 0, y: 1 };
        case 'EAST':  return { x: 1, y: 0 };
        case 'WEST':  return { x: -1, y: 0 };
        default:      return { x: 0, y: 0 };
    }
}

// Wektor prostopadły do danego wektora
function perpendicularVector(vec) {
    return { x: -vec.y, y: vec.x };
}

function drawLine(ctx, x1, y1, x2, y2, color, dashed = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (dashed) {
        ctx.setLineDash([5, 5]);
    } else {
        ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawArrow(ctx, x1, y1, x2, y2, color, arrowSize = 10) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
        x2 - arrowSize * Math.cos(angle - Math.PI / 6),
        y2 - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        x2 - arrowSize * Math.cos(angle + Math.PI / 6),
        y2 - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.lineTo(x2, y2);
    ctx.fill();
}

const IntersectionVisualizer = () => {
    const [data, setData] = useState(null);
    const [nextStepResponse, setNextStepResponse] = useState(null);
    const [selectedIntersection, setSelectedIntersection] = useState("intersection");
    const [logs, setLogs] = useState([]);
    const [jsonFile, setJsonFile] = useState(null); // stan przechowujący wybrany plik JSON
    const canvasRef = useRef(null);
    const iconAreasRef = useRef([]);
    const centralIconRef = useRef(null);
    const dataRef = useRef(data);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Pobiera dane skrzyżowania i logi
    const fetchIntersection = () => {
        fetch('http://localhost:8080/get-intersection')
            .then(response => response.json())
            .then(json => {
                setData(json);
                fetchLogs();
            })
            .catch(err => console.error("Błąd podczas pobierania danych:", err));
    };

    const fetchLogs = () => {
        fetch('http://localhost:8080/get-logs')
            .then(response => response.json())
            .then(json => setLogs(json))
            .catch(err => console.error("Błąd podczas pobierania logów:", err));
    };

    useEffect(() => {
        fetchIntersection();
    }, []);

    const handleGenerateCars = () => {
        fetch('http://localhost:8080/generate-cars')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Błąd przy generowaniu pojazdów');
                }
                fetchIntersection();
            })
            .catch(err => console.error(err));
    };

    const handleNextStep = () => {
        fetch('http://localhost:8080/next-step')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Błąd przy wywołaniu next-step');
                }
                return response.json();
            })
            .then(json => {
                setNextStepResponse(json);
                fetchIntersection();
            })
            .catch(err => console.error(err));
    };

    const handleSetIntersection = () => {
        fetch(`http://localhost:8080/set-intersection?intersectionName=${selectedIntersection}`)
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => { throw new Error(text); });
                }
                return response.text();
            })
            .then(() => {
                fetchIntersection();
            })
            .catch(err => alert(`Błąd: ${err.message}`));
    };

    // Obsługa przesłania pliku JSON
    const handleJsonFileChange = (e) => {
        if (e.target.files.length > 0) {
            setJsonFile(e.target.files[0]);
        }
    };

    const handleUploadJson = () => {
        if (!jsonFile) {
            alert("Proszę wybrać plik JSON.");
            return;
        }
        const formData = new FormData();
        formData.append("file", jsonFile);
        fetch('http://localhost:8080/upload-json', {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Błąd przy przesyłaniu pliku.');
                }
                return response.text();
            })
            .then(text => {
                const newWindow = window.open("", "_blank");
                newWindow.document.write(`<pre>${text}</pre>`);
            })
            .then(() => {
                fetchIntersection();
            })
            .catch(err => alert("Błąd: " + err.message));
    };

    // Dodajemy globalny listener kliknięć tylko raz
    useEffect(() => {
        const canvas = canvasRef.current;
        const handleCanvasClick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // Sprawdzamy centralną ikonę
            if (centralIconRef.current &&
                clickX >= centralIconRef.current.x &&
                clickX <= centralIconRef.current.x + centralIconRef.current.width &&
                clickY >= centralIconRef.current.y &&
                clickY <= centralIconRef.current.y + centralIconRef.current.height) {
                const currentData = dataRef.current;
                const vehiclesList = currentData && currentData.vehiclesInside && currentData.vehiclesInside.length > 0
                    ? currentData.vehiclesInside
                        .map(v =>
                            `${v.name} (Speed: ${v.speed}, Start: ${v.startDirection} , Destination: ${v.destination}, ${v.licensePlate ? `Plate: ${v.licensePlate}` : `Line: ${v.lineName || 'Brak'}`})`
                        )
                        .join('\n')
                    : "Brak pojazdów";
                alert(`Pojazdy wewnątrz skrzyżowania:\n${vehiclesList}`);
                return;
            }

            // Sprawdzamy ikony dróg
            for (const icon of iconAreasRef.current) {
                if (
                    clickX >= icon.x &&
                    clickX <= icon.x + icon.width &&
                    clickY >= icon.y &&
                    clickY <= icon.y + icon.height
                ) {
                    const vehiclesList = icon.vehicles && icon.vehicles.length > 0
                        ? icon.vehicles
                            .map(v => `${v.name} (Speed: ${v.speed} ,Start: ${v.startDirection}, Destination: ${v.destination}, Plate: ${v.licensePlate || 'Brak'})`)
                            .join('\n')
                        : "Brak pojazdów";
                    alert(`Droga ${icon.routeUid}\nPojazdy:\n${vehiclesList}`);
                    break;
                }
            }
        };

        canvas.addEventListener('click', handleCanvasClick);
        return () => {
            canvas.removeEventListener('click', handleCanvasClick);
        };
    }, []);

    // Rysowanie wizualizacji
    useEffect(() => {
        if (!data) return;
        const canvas = canvasRef.current;
        // Ustawiamy rozmiar wizualizacji na 780x780 pikseli
        canvas.width = 780;
        canvas.height = 780;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        iconAreasRef.current = [];
        centralIconRef.current = null;

        // Grupujemy drogi według kierunku startowego
        const groups = {};
        data.routes.forEach(route => {
            const dir = route.startDirection;
            if (!groups[dir]) groups[dir] = [];
            groups[dir].push(route);
        });

        // Dodajemy drogę wylotową do każdej grupy
        const outgoingDirs = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
        outgoingDirs.forEach(dir => {
            if (!groups[dir]) groups[dir] = [];
            groups[dir].push({
                routeUid: `outgoing-${dir}`,
                startDirection: dir,
                outgoing: true,
                vehicles: []
            });
        });

        const countNS = ((groups.NORTH || []).filter(r => !r.outgoing).length)
            + ((groups.SOUTH || []).filter(r => !r.outgoing).length);
        const countWE = ((groups.EAST || []).filter(r => !r.outgoing).length)
            + ((groups.WEST || []).filter(r => !r.outgoing).length);

        const rectWidth = 8 * laneWidth + countNS * laneWidth;
        const rectHeight = 8 * laneWidth + countWE * laneWidth;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Rysujemy skrzyżowanie
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - rectWidth / 2, centerY - rectHeight / 2, rectWidth, rectHeight);

        // Rysujemy centralną ikonę vehiclesInside
        if (data.vehiclesInside) {
            const iconSize = 15;
            const vehiclesCount = data.vehiclesInside.length;
            ctx.fillStyle = "gray";
            ctx.fillRect(centerX - iconSize / 2, centerY - iconSize / 2, iconSize, iconSize);
            ctx.fillStyle = "black";
            ctx.font = "12px Arial";
            ctx.fillText(vehiclesCount, centerX - 5, centerY - iconSize / 2 - 3);
            centralIconRef.current = { x: centerX - iconSize / 2, y: centerY - iconSize / 2, width: iconSize, height: iconSize };
        }

        const offsetDistance = 60;

        // Rysujemy drogi przychodzące i wylotowe
        Object.keys(groups).forEach(startDir => {
            const group = groups[startDir];
            const vec = directionVector(startDir);
            const perp = perpendicularVector(vec);
            const n = group.length;
            group.forEach((route, i) => {
                const groupOffset = (i - (n - 1) / 2) * offsetDistance;
                let startCenter, endCenter;
                if (route.outgoing) {
                    if (startDir === 'NORTH') {
                        startCenter = { x: centerX + perp.x * groupOffset, y: centerY - rectHeight / 2 };
                    } else if (startDir === 'SOUTH') {
                        startCenter = { x: centerX + perp.x * groupOffset, y: centerY + rectHeight / 2 };
                    } else if (startDir === 'EAST') {
                        startCenter = { x: centerX + rectWidth / 2, y: centerY + perp.y * groupOffset };
                    } else if (startDir === 'WEST') {
                        startCenter = { x: centerX - rectWidth / 2, y: centerY + perp.y * groupOffset };
                    }
                    endCenter = {
                        x: startCenter.x + vec.x * outgoingLength,
                        y: startCenter.y + vec.y * outgoingLength
                    };
                } else {
                    const baseX = centerX + vec.x * roadLength;
                    const baseY = centerY + vec.y * roadLength;
                    startCenter = {
                        x: baseX + perp.x * groupOffset,
                        y: baseY + perp.y * groupOffset
                    };
                    if (startDir === 'NORTH') {
                        endCenter = { x: startCenter.x, y: centerY - rectHeight / 2 };
                    } else if (startDir === 'SOUTH') {
                        endCenter = { x: startCenter.x, y: centerY + rectHeight / 2 };
                    } else if (startDir === 'EAST') {
                        endCenter = { x: centerX + rectWidth / 2, y: startCenter.y };
                    } else if (startDir === 'WEST') {
                        endCenter = { x: centerX - rectWidth / 2, y: startCenter.y };
                    }
                }

                const startLeft = {
                    x: startCenter.x + perp.x * (laneWidth / 2),
                    y: startCenter.y + perp.y * (laneWidth / 2)
                };
                const startRight = {
                    x: startCenter.x - perp.x * (laneWidth / 2),
                    y: startCenter.y - perp.y * (laneWidth / 2)
                };
                const endLeft = {
                    x: endCenter.x + perp.x * (laneWidth / 2),
                    y: endCenter.y + perp.y * (laneWidth / 2)
                };
                const endRight = {
                    x: endCenter.x - perp.x * (laneWidth / 2),
                    y: endCenter.y - perp.y * (laneWidth / 2)
                };

                const isDashed = (!route.outgoing && route.roadType && route.roadType.toUpperCase() === "TRAILS");
                const roadColor = route.outgoing
                    ? colors.OUTGOING
                    : (colors[route.color] || 'black');

                drawLine(ctx, startLeft.x, startLeft.y, endLeft.x, endLeft.y, roadColor, isDashed);
                drawLine(ctx, startRight.x, startRight.y, endRight.x, endRight.y, roadColor, isDashed);

                if (!route.outgoing) {
                    const laneCenter = {
                        x: (endLeft.x + endRight.x) / 2,
                        y: (endLeft.y + endRight.y) / 2
                    };

                    const trafficLightCenter = {
                        x: (startCenter.x + laneCenter.x) / 2,
                        y: (startCenter.y + laneCenter.y) / 2
                    };
                    const signalRadius = laneWidth / 3;
                    ctx.beginPath();
                    ctx.arc(trafficLightCenter.x, trafficLightCenter.y, signalRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = roadColor;
                    ctx.fill();
                    ctx.strokeStyle = "#000";
                    ctx.stroke();

                    const iconOffset = laneWidth;
                    const carIconX = trafficLightCenter.x - vec.x * iconOffset;
                    const carIconY = trafficLightCenter.y - vec.y * iconOffset;
                    const iconSize = 15;
                    ctx.fillStyle = "gray";
                    ctx.fillRect(carIconX - iconSize / 2, carIconY - iconSize / 2, iconSize, iconSize);
                    iconAreasRef.current.push({
                        routeUid: route.routeUid,
                        vehicles: route.vehicles,
                        x: carIconX - iconSize / 2,
                        y: carIconY - iconSize / 2,
                        width: iconSize,
                        height: iconSize
                    });

                    const numberOffset = laneWidth * 1.5;
                    const queueNumberX = trafficLightCenter.x - vec.x * numberOffset;
                    const queueNumberY = trafficLightCenter.y - vec.y * numberOffset;
                    ctx.fillStyle = "black";
                    ctx.font = "12px Arial";
                    const queueNumber = route.vehicles && route.vehicles.length ? route.vehicles.length : 0;
                    ctx.fillText(queueNumber, queueNumberX - 5, queueNumberY - 3);

                    route.endDirection.forEach((endDir) => {
                        const turnVec = directionVector(endDir);
                        const arrowLen = laneWidth / 2;
                        const turnEnd = {
                            x: laneCenter.x + turnVec.x * arrowLen,
                            y: laneCenter.y + turnVec.y * arrowLen
                        };
                        drawArrow(ctx, laneCenter.x, laneCenter.y, turnEnd.x, turnEnd.y, 'red', 5);
                    });

                    ctx.fillStyle = "black";
                    ctx.font = "12px Arial";
                    ctx.fillText(route.routeUid, startCenter.x + 11, startCenter.y - 12);
                }
            });
        });
    }, [data]);

    return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Lewa kolumna: kontrolki oraz lewy podpanel z odpowiedzią i wizualizacją */}
            <div>
                <h1 style={{ textAlign: 'center' }}>Intersection Visualizer</h1>
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                    <button onClick={handleGenerateCars} style={{ marginRight: '10px' }}>
                        Generate Cars
                    </button>
                    <button onClick={handleNextStep} style={{ marginRight: '10px' }}>
                        Next Step
                    </button>
                    <select
                        value={selectedIntersection}
                        onChange={(e) => setSelectedIntersection(e.target.value)}
                        style={{ marginRight: '10px' }}
                    >
                        <option value="intersection">intersection</option>
                        <option value="intersection2">intersection2</option>
                        <option value="intersection3">intersection3</option>
                        <option value="intersection4">intersection4</option>
                    </select>
                    <button onClick={handleSetIntersection} style={{ marginRight: '10px' }}>
                        Set Intersection
                    </button>
                    {/* Nowy element: wybór pliku JSON i przycisk do uploadu */}
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleJsonFileChange}
                        style={{ marginRight: '10px' }}
                    />
                    <button onClick={handleUploadJson}>
                        JSON Simulation
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {/* Lewy podpanel: odpowiedź z /next-step */}
                    {nextStepResponse && (
                        <div style={{ marginRight: '10px', minWidth: '300px', maxWidth: '300px', border: '1px solid #ccc', padding: '10px' }}>
                            <h3>Odpowiedź z /next-step:</h3>
                            {JSON.stringify(nextStepResponse, null, 2)}
                        </div>
                    )}
                    {/* Prawy podpanel: wizualizacja */}
                    <canvas ref={canvasRef} style={{ border: '15px solid #ccc' }}></canvas>
                </div>
            </div>
            {/* Prawa kolumna: logi */}
            <div style={{ marginLeft: '20px', maxWidth: '400px' }}>
                <h2>Logi</h2>
                <div style={{ border: '1px solid #ccc', padding: '10px', height: '780px', overflowY: 'auto', textAlign: 'left' }}>
                    {logs && logs.length > 0 ? (
                        logs.map(log => (
                            <div key={log.id} style={{ marginBottom: '5px' }}>
                                <strong>Step {log.step}:</strong> {log.message}
                                <br />
                                <small>{new Date(log.timestamp).toLocaleString()}</small>
                            </div>
                        ))
                    ) : (
                        <p>Brak logów</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IntersectionVisualizer;
