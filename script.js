document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('roofCanvas');
    const ctx = canvas.getContext('2d');
    const canvasContainer = document.getElementById('canvas-container');
    const messageBox = document.getElementById('message-box');
    const editPanel = document.getElementById('edit-panel');
    const editFields = document.getElementById('edit-fields');
    const inputSheetWidth = document.getElementById('ancho-util');
    const btnDistribute = document.getElementById('btn-distribute');
    
    let shapes = [];
    let currentShape = null;
    let currentTool = 'select'; // select, rectangle, trapezoid, triangle

    // Panning and Zoom variables
    let scale = 1.0;
    let originX = 0;
    let originY = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isPanning = false;

    // Dragging variables for points and guideline
    let isDragging = false;
    let dragPointIndex = -1;
    let isDraggingGuideline = false;
    let dragStartY = 0; // Stores initial Y for the base
    const dragRadius = 5; // Reduced size of the drag points
    let guideLineX = null;
    let sheetWidth = 100; // Default value: 1 meter in canvas units (100cm)

    // Buttons
    const btnRectangle = document.getElementById('btn-rectangle');
    const btnTrapezoid = document.getElementById('btn-trapezoid');
    const btnTriangle = document.getElementById('btn-triangle');
    const btnDelete = document.getElementById('btn-delete');
    const btnGuideline = document.getElementById('btn-guideline');

    btnRectangle.addEventListener('click', () => {
        const newShape = {
            type: 'rectangle',
            points: [
                { x: -75, y: -25 }, // Top-left
                { x: 75, y: -25 },  // Top-right
                { x: 75, y: 25 },   // Bottom-right
                { x: -75, y: 25 }   // Bottom-left
            ],
            color: '#4b5563', // Dark gray
            sheets: []
        };
        shapes.push(newShape);
        selectShape(newShape);
        showMessage('Rectángulo creado');
    });

    btnTrapezoid.addEventListener('click', () => {
        const newShape = {
            type: 'trapezoid',
            points: [
                { x: -60, y: -25 }, // Top-left
                { x: 60, y: -25 },  // Top-right
                { x: 40, y: 25 },   // Bottom-right
                { x: -40, y: 25 }   // Bottom-left
            ],
            color: '#4b5563', // Dark gray
            sheets: []
        };
        shapes.push(newShape);
        selectShape(newShape);
        showMessage('Trapezoide creado');
    });

    btnTriangle.addEventListener('click', () => {
        const newShape = {
            type: 'triangle',
            points: [
                { x: -20, y: -50 }, // Apex
                { x: 50, y: 50 },   // Bottom-right
                { x: -50, y: 50 }   // Bottom-left
            ],
            color: '#4b5563', // Dark gray
            sheets: []
        };
        shapes.push(newShape);
        selectShape(newShape);
        showMessage('Triángulo creado');
    });

    btnDelete.addEventListener('click', deleteCurrentShape);

    btnGuideline.addEventListener('click', () => {
        // Position the guideline in the center of the canvas
        guideLineX = 0;
        showMessage('Línea guía agregada');
        draw();
    });

    inputSheetWidth.addEventListener('change', (e) => {
        sheetWidth = parseFloat(e.target.value) * 100;
        if (isNaN(sheetWidth) || sheetWidth <= 0) {
            sheetWidth = 100; // Reset to default if invalid
            inputSheetWidth.value = "1.00";
        }
        // Clear sheets when the sheet width is changed
        if (currentShape) {
            currentShape.sheets = [];
        }
        draw();
    });

    btnDistribute.addEventListener('click', distributeSheets);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteCurrentShape();
        }
    });

    function deleteCurrentShape() {
        if (currentShape) {
            const index = shapes.indexOf(currentShape);
            if (index > -1) {
                shapes.splice(index, 1);
                selectShape(null); // Deselect the shape
                showMessage('Figura eliminada');
            }
        }
    }

    function showMessage(msg) {
        messageBox.textContent = msg;
        messageBox.classList.add('show');
        setTimeout(() => {
            messageBox.classList.remove('show');
        }, 2000);
    }

    function selectShape(shape) {
        if (currentShape) {
            currentShape.color = '#4b5563'; // Dark gray
            // Do not clear sheets here, they should persist
        }
        currentShape = shape;
        if (currentShape) {
            currentShape.color = '#b91c1c'; // Dark red for selected
            updateEditPanel();
            editPanel.classList.remove('hidden');
        } else {
            editPanel.classList.add('hidden');
        }
        draw();
    }

    function updateEditPanel() {
        if (!currentShape) return;
        editFields.innerHTML = '';
        const sideLabels = {
            'rectangle': ['Ancho', 'Altura'],
            'trapezoid': ['Lado Superior', 'Lado Inferior'],
            'triangle': ['Lado A', 'Lado B', 'Lado C']
        };
        // Calculate dimensions for all sides of the polygon
        const dimensions = calculateDimensions(currentShape.points);
        const labels = sideLabels[currentShape.type] || [];

        dimensions.forEach((dim, index) => {
            // Only show editable fields for the two primary dimensions for rectangle and trapezoid
            if ((currentShape.type === 'rectangle' && (index === 0 || index === 3)) ||
                (currentShape.type === 'trapezoid' && (index === 0 || index === 2)) ||
                (currentShape.type === 'triangle')) {
                
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2';
                div.innerHTML = `
                    <label class="text-gray-600 font-medium whitespace-nowrap">${labels[index]}:</label>
                    <input type="text" class="shape-input p-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value="${(dim / 100).toFixed(2)}">
                    <span class="text-gray-500 text-sm">m</span>
                `;
                const input = div.querySelector('input');
                input.addEventListener('change', (e) => {
                    const newValue = parseFloat(e.target.value) * 100; // Convert from meters to canvas units
                    if (!isNaN(newValue)) {
                        updateShapeDimension(index, newValue);
                    }
                    // Clear sheets when a dimension is changed
                    if (currentShape) {
                        currentShape.sheets = [];
                    }
                });
                editFields.appendChild(div);
            }
        });
    }

    function updateShapeDimension(sideIndex, newValue) {
        const points = currentShape.points;
        let newPoints = [...points];
        
        // Simplified logic to reshape based on the side edited.
        if (currentShape.type === 'rectangle' || currentShape.type === 'trapezoid') {
            if (sideIndex === 0) { // Top side
                const originalLength = distance(points[0], points[1]);
                const ratio = newValue / originalLength;
                newPoints[0].x = points[0].x * ratio;
                newPoints[1].x = points[1].x * ratio;
            } else if (sideIndex === 2) { // Bottom side
                const originalLength = distance(points[2], points[3]);
                const ratio = newValue / originalLength;
                newPoints[2].x = points[2].x * ratio;
                newPoints[3].x = points[3].x * ratio;
            }
        } else if (currentShape.type === 'triangle') {
            // Editing a single side of a triangle is complex.
            // For simplicity, we adjust the scale.
            const originalLength = distance(points[0], points[1]);
            const ratio = newValue / originalLength;
            newPoints[0].x *= ratio;
            newPoints[0].y *= ratio;
            newPoints[1].x *= ratio;
            newPoints[1].y *= ratio;
            newPoints[2].x *= ratio;
            newPoints[2].y *= ratio;
        }

        currentShape.points = newPoints;
        updateEditPanel();
        draw();
    }

    function resizeCanvas() {
        canvas.width = canvasContainer.clientWidth;
        canvas.height = canvasContainer.clientHeight;
        draw();
    }

    function distance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function calculateDimensions(points) {
        const dimensions = [];
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            dimensions.push(distance(p1, p2));
        }
        return dimensions;
    }

    function drawGrid() {
        ctx.save();
        ctx.translate(canvas.width / 2 + originX * scale, canvas.height / 2 + originY * scale);
        ctx.scale(scale, scale);

        const gridSize = 100; // 1 meter
        const subGridSize = 10; // 10 cm
        
        // 1-meter lines
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        for (let x = -canvas.width / (2 * scale) - originX; x < canvas.width / (2 * scale) - originX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, -canvas.height / (2 * scale) - originY);
            ctx.lineTo(x, canvas.height / (2 * scale) - originY);
            ctx.stroke();
        }
        for (let y = -canvas.height / (2 * scale) - originY; y < canvas.height / (2 * scale) - originY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(-canvas.width / (2 * scale) - originX, y);
            ctx.lineTo(canvas.width / (2 * scale) - originX, y);
            ctx.stroke();
        }
        
        // 10-cm lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;
        for (let x = -canvas.width / (2 * scale) - originX; x < canvas.width / (2 * scale) - originX; x += subGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, -canvas.height / (2 * scale) - originY);
            ctx.lineTo(x, canvas.height / (2 * scale) - originY);
            ctx.stroke();
        }
        for (let y = -canvas.height / (2 * scale) - originY; y < canvas.height / (2 * scale) - originY; y += subGridSize) {
            ctx.beginPath();
            ctx.moveTo(-canvas.width / (2 * scale) - originX, y);
            ctx.lineTo(canvas.width / (2 * scale) - originX, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    function getHighestPointInXRange(shape, startX, endX) {
        let highestY = Infinity; // We want the lowest Y value, which is the "highest" on the canvas
        const points = shape.points;
        
        // Check all points of the shape
        for (const p of points) {
            if (p.x >= startX && p.x <= endX) {
                highestY = Math.min(highestY, p.y);
            }
        }
        
        // Check for intersections with the startX and endX lines
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            
            // Intersection with startX line
            if (p2.x - p1.x !== 0 && ((p1.x <= startX && p2.x >= startX) || (p2.x <= startX && p1.x >= startX))) {
                const y = p1.y + (startX - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
                highestY = Math.min(highestY, y);
            }

            // Intersection with endX line
            if (p2.x - p1.x !== 0 && ((p1.x <= endX && p2.x >= endX) || (p2.x <= endX && p1.x >= endX))) {
                const y = p1.y + (endX - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
                highestY = Math.min(highestY, y);
            }
        }
        return highestY;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();

        ctx.save();
        ctx.translate(canvas.width / 2 + originX * scale, canvas.height / 2 + originY * scale);
        ctx.scale(scale, scale);

        // Draw the guideline if it exists
        if (guideLineX !== null) {
            ctx.beginPath();
            ctx.setLineDash([5, 5]); // Dashed line
            ctx.strokeStyle = '#d97706'; // Dark amber
            ctx.lineWidth = 1.5 / scale;
            ctx.moveTo(guideLineX, -canvas.height / (2 * scale) - originY);
            ctx.lineTo(guideLineX, canvas.height / (2 * scale) - originY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset to solid line

            // Draw the guideline measurement text
            ctx.font = `bold ${12 / scale}px sans-serif`;
            ctx.fillStyle = '#d97706'; // Dark amber
            ctx.textAlign = 'center';
            const distanceMeters = guideLineX / 100;
            ctx.fillText(`${distanceMeters.toFixed(2)}m`, guideLineX, -canvas.height / (2 * scale) - originY + 20);
        }

        shapes.forEach(shape => {
            // Draw the sheets as filled polygons first
            if (shape.sheets && shape.sheets.length > 0) {
                ctx.fillStyle = 'rgba(209, 213, 219, 0.5)'; // Light gray, translucent
                ctx.strokeStyle = '#9ca3af'; // Gray
                ctx.lineWidth = 1 / scale;
                shape.sheets.forEach(sheetPoints => {
                    ctx.beginPath();
                    if (sheetPoints.length > 0) {
                        ctx.moveTo(sheetPoints[0].x, sheetPoints[0].y);
                        for (let i = 1; i < sheetPoints.length; i++) {
                            ctx.lineTo(sheetPoints[i].x, sheetPoints[i].y);
                        }
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();

                        // Draw the height measurement inside the sheet
                        const topY = sheetPoints[0].y;
                        const bottomY = sheetPoints[2].y;
                        const height = Math.abs(bottomY - topY);
                        const heightMeters = (height / 100).toFixed(2);
                        
                        const centerX = (sheetPoints[0].x + sheetPoints[1].x) / 2;
                        const centerY = (topY + bottomY) / 2;
                        
                        const text = `${heightMeters}m`;
                        ctx.font = `bold ${12 / scale}px sans-serif`;
                        const textWidth = ctx.measureText(text).width;
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // More opaque background for text
                        ctx.fillRect(centerX - textWidth / 2 - 5, centerY - 10 / scale, textWidth + 10, 20 / scale);

                        ctx.fillStyle = '#1f2937'; // Dark gray text
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, centerX, centerY);
                    }
                });
            }

            // Draw the roof shape on top of the sheets
            ctx.beginPath();
            const firstPoint = shape.points[0];
            ctx.moveTo(firstPoint.x, firstPoint.y);
            shape.points.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fillStyle = shape.color + '60';
            ctx.fill();
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = 1.5; // Thinner line
            ctx.stroke();
            
            // Draw drag points if it's the current shape
            if (shape === currentShape) {
                ctx.fillStyle = '#b91c1c'; // Darker red
                shape.points.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, dragRadius / scale, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }

            // Draw measurements
            ctx.font = `bold ${12 / scale}px sans-serif`;
            ctx.fillStyle = '#374151';
            for (let i = 0; i < shape.points.length; i++) {
                const p1 = shape.points[i];
                const p2 = shape.points[(i + 1) % shape.points.length];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                ctx.save();
                ctx.translate(midX, midY);
                ctx.rotate(angle);
                const lengthMeters = distance(p1, p2) / 100;
                ctx.fillText(`${lengthMeters.toFixed(2)}m`, 0, -5);
                ctx.restore();
            }
        });

        ctx.restore();
    }
    
    function distributeSheets() {
        if (!currentShape) {
            showMessage('Por favor, selecciona una figura primero.');
            return;
        }
        
        currentShape.sheets = [];
        let sheetCount = 0;
        const points = currentShape.points;
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const maxY = Math.max(...points.map(p => p.y)); // Explicitly find the lowest point
        
        if (sheetWidth <= 0) {
            showMessage('El ancho de la lámina no es válido.');
            return;
        }
        
        let startDistributionX = guideLineX !== null ? guideLineX : minX;

        // Find the leftmost starting point for the distribution
        let currentX = startDistributionX;
        while (currentX > minX) {
            currentX -= sheetWidth;
        }

        // Distribute sheets from the leftmost point to the rightmost point of the shape
        while (currentX < maxX) {
            const xEnd = currentX + sheetWidth;
            const highestY = getHighestPointInXRange(currentShape, currentX, xEnd);
            
            const sheet = [
                { x: currentX, y: highestY },
                { x: xEnd, y: highestY },
                { x: xEnd, y: maxY },
                { x: currentX, y: maxY }
            ];

            currentShape.sheets.push(sheet);
            sheetCount++;
            currentX += sheetWidth;
        }
        
        draw();
        showMessage(`Se distribuirán ${sheetCount} láminas.`);
    }
    
    // Canvas Event Logic
    canvas.addEventListener('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const transformedX = (mouseX - canvas.width / 2 - originX * scale) / scale;
        const transformedY = (mouseY - canvas.height / 2 - originY * scale) / scale;

        isDragging = false;
        isDraggingGuideline = false;

        if (guideLineX !== null && Math.abs(transformedX - guideLineX) < 10 / scale) {
            isDraggingGuideline = true;
        } else if (currentShape) {
            for (let i = 0; i < currentShape.points.length; i++) {
                const point = currentShape.points[i];
                if (Math.hypot(point.x - transformedX, point.y - transformedY) < dragRadius / scale) {
                    isDragging = true;
                    dragPointIndex = i;
                    const isBasePoint = (i === 2 && (currentShape.type === 'rectangle' || currentShape.type === 'trapezoid')) || 
                                        (i === 3 && (currentShape.type === 'rectangle' || currentShape.type === 'trapezoid')) ||
                                        (i === 1 && currentShape.type === 'triangle') ||
                                        (i === 2 && currentShape.type === 'triangle');

                    if (isBasePoint) {
                        dragStartY = point.y;
                    }
                    break;
                }
            }
        }

        if (!isDragging && !isDraggingGuideline) {
            isPanning = true;
            canvasContainer.classList.add('panning');
        }
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    });

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const transformedX = (mouseX - canvas.width / 2 - originX * scale) / scale;
        const transformedY = (mouseY - canvas.height / 2 - originY * scale) / scale;

        if (isDragging) {
            if (currentShape && dragPointIndex !== -1) {
                const isBasePoint = (dragPointIndex === 2 && (currentShape.type === 'rectangle' || currentShape.type === 'trapezoid')) || 
                                    (dragPointIndex === 3 && (currentShape.type === 'rectangle' || currentShape.type === 'trapezoid')) ||
                                    (dragPointIndex === 1 && currentShape.type === 'triangle') ||
                                    (dragPointIndex === 2 && currentShape.type === 'triangle');

                if (isBasePoint) {
                    currentShape.points[dragPointIndex].x = transformedX;
                    currentShape.points[dragPointIndex].y = dragStartY; // Restrict vertical movement
                } else {
                    currentShape.points[dragPointIndex].x = transformedX;
                    currentShape.points[dragPointIndex].y = transformedY;
                }
                // Clear sheets when a point is dragged
                currentShape.sheets = [];
                updateEditPanel();
                draw();
            }
        } else if (isDraggingGuideline) {
            guideLineX = transformedX;
            // Clear sheets when the guideline is moved
            if (currentShape) {
                currentShape.sheets = [];
            }
            draw();
        } else if (isPanning) {
            const deltaX = (mouseX - lastMouseX) / scale;
            const deltaY = (mouseY - lastMouseY) / scale;
            originX += deltaX;
            originY += deltaY;
            lastMouseX = mouseX;
            lastMouseY = mouseY;
            draw();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        isPanning = false;
        isDraggingGuideline = false;
        dragPointIndex = -1;
        canvasContainer.classList.remove('panning');
    });

    canvas.addEventListener('click', e => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const transformedX = (mouseX - canvas.width / 2 - originX * scale) / scale;
        const transformedY = (mouseY - canvas.height / 2 - originY * scale) / scale;

        let selected = null;
        for (const shape of shapes.slice().reverse()) {
            const points = shape.points;
            if (isInsidePolygon(points, { x: transformedX, y: transformedY })) {
                selected = shape;
                break;
            }
        }
        selectShape(selected);
    });

    function isInsidePolygon(points, testPoint) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            const intersect = ((yi > testPoint.y) != (yj > testPoint.y)) &&
                             (testPoint.x < (xj - xi) * (testPoint.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        // Increased sensitivity for a smoother zoom
        const delta = e.deltaY * -0.005; 
        const newScale = Math.max(0.1, Math.min(5.0, scale + delta));

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - canvas.width / 2) / scale;
        const canvasY = (mouseY - canvas.height / 2) / scale;

        originX -= canvasX - (canvasX * scale / newScale);
        originY -= canvasY - (canvasY * scale / newScale);
        
        scale = newScale;
        draw();
    });

    // Initialization
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
});
