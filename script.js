let households = {};
let selectedHousehold = null;
let noiseMeasurementRunning = false;
let decibelChart;

// 탭 전환 함수
function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// 결과 탭 전환 함수
function openResultTab(evt, resultTabName) {
    const resultContent = document.getElementsByClassName("resultContent");
    for (let i = 0; i < resultContent.length; i++) {
        resultContent[i].style.display = "none";
    }
    document.getElementById(resultTabName).style.display = "block";
    evt.currentTarget.className += " active";

    // 분포표 탭이 열리면 그래프를 업데이트
    if (resultTabName === 'distributionResult') {
        updateHistogram();
    }
}

// 동호수표 생성 관련 코드
document.getElementById('addBuildingBtn').addEventListener('click', function () {
    document.getElementById('buildingFormContainer').classList.remove('hidden');
});

let lineCount = 0;
let lineData = [];

document.getElementById('addLineBtn').addEventListener('click', function () {
    lineCount++;
    const lineInputDiv = document.createElement('div');
    lineInputDiv.classList.add('lineInputDiv');
    lineInputDiv.innerHTML = `
        <label>라인 ${lineCount}: </label>
        <input type="number" id="lineFloorCount${lineCount}" placeholder="몇 층까지" min="1">
    `;
    document.getElementById('lineInputsContainer').appendChild(lineInputDiv);
    lineData.push({ line: lineCount, floors: 0 });
});

document.getElementById('addFinalBuildingBtn').addEventListener('click', function () {
    const buildingNumber = document.getElementById('buildingNumber').value;
    if (!buildingNumber) {
        alert('동 번호를 입력하세요.');
        return;
    }
    lineData = lineData.map((line) => {
        const floors = document.getElementById(`lineFloorCount${line.line}`).value;
        return { line: line.line, floors: floors ? parseInt(floors) : 0 };
    });
    createBuilding(buildingNumber, lineData);
    document.getElementById('buildingFormContainer').classList.add('hidden');
    updateHouseholdSelect();
    lineData = [];
    lineCount = 0;
    document.getElementById('lineInputsContainer').innerHTML = '';
});

function createBuilding(buildingNumber, lines) {
    const buildingContainer = document.getElementById('buildingContainer');
    const newBuilding = document.createElement('div');
    newBuilding.classList.add('building');
    newBuilding.innerHTML = `<h3>${buildingNumber}동</h3>`;

    const maxFloors = Math.max(...lines.map(line => line.floors));

    for (let floor = maxFloors; floor >= 1; floor--) {
        const lineContainer = document.createElement('div');
        lineContainer.classList.add('line');

        lines.forEach(line => {
            const roomDiv = document.createElement('div');
            roomDiv.classList.add('room');
            if (floor <= line.floors) {
                const roomNumber = `${floor * 100 + line.line}호`;
                roomDiv.innerText = roomNumber;
                households[`${buildingNumber}-${roomNumber}`] = { building: buildingNumber, room: roomNumber, noiseLevel: null };
            }
            lineContainer.appendChild(roomDiv);
        });
        newBuilding.appendChild(lineContainer);
    }

    buildingContainer.appendChild(newBuilding);
}

// 세대 선택 목록 업데이트 함수
function updateHouseholdSelect() {
    const householdSelect = document.getElementById('householdSelectMeasure');
    householdSelect.innerHTML = '<option value="">세대 선택</option>';
    Object.keys(households).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        householdSelect.appendChild(option);
    });
}

// 측정 관련 코드
document.getElementById('householdSelectMeasure').addEventListener('change', function (e) {
    selectedHousehold = e.target.value;
    document.getElementById('startButton').disabled = !selectedHousehold;
});

let decibelData = [];
const maxChartPoints = 50; // 그래프에 표시할 최대 데이터 포인트

function initializeDecibelChart() {
    const ctx = document.getElementById('decibelChart').getContext('2d');
    decibelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Decibel Level',
                data: [],
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            animation: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Decibels (dB)'
                    },
                    min: 0,
                    max: 120
                }
            }
        }
    });
}

document.getElementById('startButton').addEventListener('click', async () => {
    if (!selectedHousehold) return;

    document.getElementById('startButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    noiseMeasurementRunning = true;
    decibelData = [];
    document.getElementById('decibelDisplay').textContent = '-- dB';

    // 마이크를 이용해 소음 측정 시작
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        scriptProcessor.onaudioprocess = () => {
            if (!noiseMeasurementRunning) return;

            const buffer = new Float32Array(analyser.fftSize);
            analyser.getFloatTimeDomainData(buffer);

            let sum = 0.0;
            for (let i = 0; i < buffer.length; i++) {
                sum += buffer[i] * buffer[i];
            }
            const rms = Math.sqrt(sum / buffer.length);
            const decibel = 20 * Math.log10(rms);

            const displayDecibel = decibel === -Infinity ? 0 : Math.max(0, decibel + 100);
            document.getElementById('decibelDisplay').textContent = `${displayDecibel.toFixed(2)} dB`;

            // 그래프 업데이트
            if (decibelChart) {
                decibelData.push(displayDecibel);
                if (decibelData.length > maxChartPoints) {
                    decibelData.shift(); // 데이터 포인트의 수를 제한
                }
                decibelChart.data.labels = decibelData.map((_, index) => index);
                decibelChart.data.datasets[0].data = decibelData;
                decibelChart.update();
            }
        };
    } catch (error) {
        alert('마이크 권한이 필요합니다.');
    }
});

document.getElementById('stopButton').addEventListener('click', () => {
    noiseMeasurementRunning = false;
    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;

    // 저장 버튼 활성화
    document.getElementById('saveButton').classList.remove('hidden');
});

document.getElementById('saveButton').addEventListener('click', () => {
    if (selectedHousehold && decibelData.length > 0) {
        const avgNoiseLevel = decibelData.reduce((sum, val) => sum + val, 0) / decibelData.length;
        households[selectedHousehold].noiseLevel = avgNoiseLevel.toFixed(2);
        alert(`저장 완료! 평균 소음 레벨: ${avgNoiseLevel.toFixed(2)} dB`);

        // 결과를 대시보드에 반영
        renderDashboard();

        // 저장 버튼 숨기기
        document.getElementById('saveButton').classList.add('hidden');
    }
});

// 대시보드 결과 업데이트
function renderDashboard() {
    renderApartmentResults();
    renderDistributionResults();
    document.getElementById('resultTabs').classList.remove('hidden');
}

function renderApartmentResults() {
    const container = document.getElementById('apartment-container');
    container.innerHTML = ''; // 기존 내용 지우기

    const groupedByBuilding = {};

    // 동별로 데이터를 그룹화
    Object.values(households).forEach(household => {
        const buildingNumber = household.building;
        if (!groupedByBuilding[buildingNumber]) {
            groupedByBuilding[buildingNumber] = [];
        }
        groupedByBuilding[buildingNumber].push(household);
    });

    // 동별로 동호수표 생성
    Object.keys(groupedByBuilding).forEach(buildingNumber => {
        const buildingDiv = document.createElement('div');
        buildingDiv.classList.add('building');
        buildingDiv.innerHTML = `<h4>${buildingNumber}동</h4>`;

        // 해당 동의 세대들 정렬
        const householdsInBuilding = groupedByBuilding[buildingNumber].sort((a, b) => {
            // 기존의 room 값을 사용하여 정확하게 정렬
            return parseInt(b.room) - parseInt(a.room);
        });

        // 방 번호에 따른 라인과 층 구조 생성
        const floors = [...new Set(householdsInBuilding.map(h => Math.floor(parseInt(h.room) / 100)))].sort((a, b) => b - a);
        const lines = [...new Set(householdsInBuilding.map(h => parseInt(h.room) % 100))].sort((a, b) => a - b);

        // 각 층을 위에서 아래로 생성
        floors.forEach(floor => {
            const lineContainer = document.createElement('div');
            lineContainer.classList.add('line');

            // 각 라인에 맞는 방 번호를 생성하고 표시
            lines.forEach(lineNumber => {
                const roomNumber = `${floor * 100 + lineNumber}호`;
                const household = householdsInBuilding.find(h => h.room === roomNumber);

                const roomDiv = document.createElement('div');
                roomDiv.classList.add('room');

                if (household) {
                    roomDiv.innerHTML = `${roomNumber}<br>${household.noiseLevel ? household.noiseLevel + ' dB' : '-- dB'}`;
                    if (household.noiseLevel) {
                        roomDiv.classList.add(household.noiseLevel >= 55 ? 'high' : 'low');
                    } else {
                        roomDiv.classList.add('no-value'); // No value - set to white
                    }
                } else {
                    roomDiv.innerHTML = `${roomNumber}<br>-- dB`;
                    roomDiv.classList.add('no-value'); // No value - set to white
                }

                lineContainer.appendChild(roomDiv);
            });
            buildingDiv.appendChild(lineContainer);
        });

        container.appendChild(buildingDiv);
    });
}



function renderDistributionResults() {
    const table = document.getElementById('data-table');
    table.innerHTML = ''; // 기존 내용 제거

    // 테이블 헤더 생성
    const header = table.insertRow();
    ['동', '호수', 'DB', '위험군'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        header.appendChild(th);
    });

    // 데이터 행 생성
    Object.values(households).forEach(household => {
        const row = table.insertRow();
        const noiseLevel = household.noiseLevel;

        row.insertCell(0).textContent = household.building;
        row.insertCell(1).textContent = household.room;
        row.insertCell(2).textContent = noiseLevel || '--';

        const riskCell = row.insertCell(3);
        if (noiseLevel >= 55) {
            riskCell.textContent = '위험군';
            row.classList.add('risk');
        } else {
            riskCell.textContent = '-';
        }
    });

    // 히스토그램 업데이트
    updateHistogram();
}

function updateHistogram() {
    const noiseLevels = Object.values(households).map(h => h.noiseLevel).filter(level => level !== null);
    const ctx = document.getElementById('dbChart').getContext('2d');

    // 기존 차트가 있다면 삭제
    if (decibelChart) {
        decibelChart.destroy();
    }

    const data = {
        labels: noiseLevels,
        datasets: [{
            label: 'Noise Level Distribution',
            data: noiseLevels,
            backgroundColor: noiseLevels.map(level => level >= 55 ? 'red' : 'blue')
        }]
    };

    decibelChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'DB Level'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Number of Units'
                    }
                }
            }
        }
    });
}

// 초기화
initializeDecibelChart();
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.tablinks').click();
});
