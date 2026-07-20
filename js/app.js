const { createApp, ref, computed, onMounted, nextTick } = Vue;

    createApp({
      setup() {
        // Active Navigation state
        const activeView = ref('instructions');
        const activeModuleTab = ref('water');
        const mobileMenuOpen = ref(false);
        const filterOnlyGaps = ref(true);
        const sidebarCollapsed = ref(false); // false = expandido (w-80), true = contraído (w-20)

        // Toast Notifications helper state
        const toast = ref({
          show: false,
          message: '',
          type: 'success'
        });

        // Show a temporary banner notification
        const triggerToast = (message, type = 'success') => {
          toast.value.message = message;
          toast.value.type = type;
          toast.value.show = true;
          setTimeout(() => {
            toast.value.show = false;
          }, 4000);
        };

        // Static List of Modules for WASH-FIT Configuration (Using PAHO Theme color badges)
        const modulesList = [
          { id: 'water', name: 'Agua', shortName: 'Agua (W)', color: 'bg-paho-blue', hex: '#008DC9' },
          { id: 'sanitation', name: 'Saneamiento', shortName: 'Saneam. (S)', color: 'bg-emerald-600', hex: '#059669' },
          { id: 'waste', name: 'Residuos Hospitalarios', shortName: 'Residuos (HCWM)', color: 'bg-amber-600', hex: '#d97706' },
          { id: 'hygiene', name: 'Higiene de Manos', shortName: 'Higiene (H)', color: 'bg-purple-600', hex: '#7c3aed' },
          { id: 'cleaning', name: 'Limpieza Hospitalaria', shortName: 'Limpieza (EC)', color: 'bg-teal-600', hex: '#0d9488' }
        ];

        // Centralized General Information state
        const generalInfo = ref({
          facilityName: 'Hospital Materno Infantil San José',
          district: 'Lima, Perú',
          // Por esto (coordenadas por defecto alineadas al mapa):
          latitude: -12.1485,
          longitude: -76.9841,
          level: 'Primer Nivel',
          type: 'Público',
          evaluationDate: new Date().toISOString().substr(0, 10),
          summary: 'La instalación cuenta con un buen suministro primario, sin embargo, se identificaron vulnerabilidades severas en segregación de residuos hospitalarios y falta de estaciones móviles de higiene de manos en salas de hospitalización de ginecología.',
          team: [
            { name: 'Dra. Elena Rostova', role: 'Directora de Epidemiología', institution: 'MINSA', responsibility: 'Coordinador WASH', isEditing: false },
            { name: 'Lic. Juan Carlos Marín', role: 'Jefe de Infraestructura', institution: 'MINSA', responsibility: 'Monitoreo de Energía y Agua', isEditing: false }
          ],
          photos: [
            { name: 'evidencia_agua_filtro.png', url: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=200' }
          ]
        });


        // Indicadores cargados desde js/data/indicators.js (INDICATORS_DATA)
        const indicators = ref(INDICATORS_DATA);
        // Reactive computed getters for statistical analytics
        const answeredCount = computed(() => {
          return indicators.value.filter(ind => ind.score !== null).length;
        });

        const progressPercentage = computed(() => {
          if (indicators.value.length === 0) return 0;
          return Math.round((answeredCount.value / indicators.value.length) * 100);
        });

        const totalGaps = computed(() => {
          return indicators.value.filter(ind => ind.score === 0 || ind.score === 1).length;
        });

        const totalScoreAchieved = computed(() => {
          return indicators.value.reduce((acc, ind) => {
            return acc + (ind.score !== null ? ind.score : 0);
          }, 0);
        });

        const overallCompliance = computed(() => {
          const evaluated = indicators.value.filter(ind => ind.score !== null);
          if (evaluated.length === 0) return 0;
          const maxPossible = evaluated.length * 2;
          const sum = evaluated.reduce((acc, ind) => acc + ind.score, 0);
          return Math.round((sum / maxPossible) * 100);
        });

        // Compute filtered list of indicators according to active module tab
        const getFilteredIndicatorsByModule = computed(() => {
          const dom = modulesList.find(d => d.id === activeModuleTab.value);
          if (!dom) return [];
          return indicators.value.filter(ind => ind.module === dom.name);
        });

        // Compute active module's progress percentage (Answered / Total in module)
        const getActiveModuleProgressPercentage = computed(() => {
          const name = getActiveModuleName.value;
          const total = getModuleTotalCount(name);
          if (total === 0) return 0;
          return Math.round((getModuleAnsweredCount(name) / total) * 100);
        });

        // Compute the list of gaps with reactive sorting (highest risk first)
        const getSortedGaps = computed(() => {
          let list = indicators.value;
          if (filterOnlyGaps.value) {
            list = list.filter(ind => ind.score === 0 || ind.score === 1);
          } else {
            list = list.filter(ind => ind.score !== null);
          }
          
          return [...list].sort((a, b) => {
            const riskA = (a.severity || 0) * (a.likelihood || 0);
            const riskB = (b.severity || 0) * (b.likelihood || 0);
            return riskB - riskA; // Descending
          });
        });

        // Paso 5 Tracking Statistics
        const trackingSummary = computed(() => {
          const gaps = indicators.value.filter(ind => ind.score === 0 || ind.score === 1);
          const counts = { noIniciado: 0, enProgreso: 0, completado: 0, retrasado: 0 };
          gaps.forEach(g => {
            if (g.trackingStatus === 'En Progreso') counts.enProgreso++;
            else if (g.trackingStatus === 'Completado') counts.completado++;
            else if (g.trackingStatus === 'Retrasado') counts.retrasado++;
            else counts.noIniciado++;
          });
          return counts;
        });

        const planProgressPercentage = computed(() => {
          const gaps = indicators.value.filter(ind => ind.score === 0 || ind.score === 1);
          if (gaps.length === 0) return 100;
          const completed = gaps.filter(g => g.trackingStatus === 'Completado').length;
          const inProgress = gaps.filter(g => g.trackingStatus === 'En Progreso').length;
          // Weighted: Completed is 100%, In Progress is 50%
          const score = (completed * 1.0) + (inProgress * 0.5);
          return Math.round((score / gaps.length) * 100);
        }); // <-- AQUÍ SE CORRIGE: Cerramos correctamente la propiedad computada

        // Ahora estas variables quedan declaradas de forma global en el setup() y funcionan perfectamente
        // Variable reactiva para saber qué fila se está editando actualmente
        const focusedCostId = ref(null);

        // Función para transformar el número plano a formato con comas (Ej: 15000 -> 15,000)
        const formatThousands = (val) => {
          if (val === null || val === undefined || val === '') return '';
          return new Intl.NumberFormat('en-US', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
          }).format(val);
        };

        // Función para limpiar las comas ingresadas y guardar el valor numérico puro en el modelo
        const updateCost = (ind, value) => {
          const cleanValue = value.replace(/,/g, '');
          if (cleanValue === '') {
            ind.cost = null;
          } else {
            const parsed = parseFloat(cleanValue);
            ind.cost = isNaN(parsed) ? null : parsed;
          }
        };

// JMP Logic mapping adaptado a la nueva matriz estructural
        const jmpCalculatedStatus = computed(() => {
          // 1. Agua (Mapeado al indicador Core JMP A_1)
          const a1 = indicators.value.find(i => i.code === 'A_1');
          let waterStatus = { status: 'Sin Servicio', class: 'bg-red-50 text-red-800 border-red-300' };
          if (a1) {
            if (a1.score === 2) {
              waterStatus = { status: 'Básico', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
            } else if (a1.score === 1) {
              waterStatus = { status: 'Limitado', class: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
          }

          // 2. Saneamiento (Mapeado a tu nuevo estándar de inodoros S_1)
          const s1 = indicators.value.find(i => i.code === 'S_1');
          let sanitationStatus = { status: 'Sin Servicio', class: 'bg-red-50 text-red-800 border-red-300' };
          if (s1) {
            if (s1.score === 2) {
              sanitationStatus = { status: 'Básico', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
            } else if (s1.score === 1) {
              sanitationStatus = { status: 'Limitado', class: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
          }

          // 3. Residuos Hospitalarios (Mapeado a tu nuevo indicador de tratamiento y disposición final RES_14)
          const res14 = indicators.value.find(i => i.code === 'RES_14');
          let wasteStatus = { status: 'Sin Servicio', class: 'bg-red-50 text-red-800 border-red-300' };
          if (res14) {
            if (res14.score === 2) {
              wasteStatus = { status: 'Básico', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
            } else if (res14.score === 1) {
              wasteStatus = { status: 'Limitado', class: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
          }

          // 4. Higiene de Manos (Mantenemos la detección con H_4 o H_1 si agregas más en el futuro)
          const h4 = indicators.value.find(i => i.code === 'H_4');
          let hygieneStatus = { status: 'Sin Servicio', class: 'bg-red-50 text-red-800 border-red-300' };
          if (h4) {
            if (h4.score === 2) {
              hygieneStatus = { status: 'Básico', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
            } else if (h4.score === 1) {
              hygieneStatus = { status: 'Limitado', class: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
          }

          // 5. Limpieza Hospitalaria (Mapeado a tu nuevo indicador Core JMP EC_1)
          const ec1 = indicators.value.find(i => i.code === 'EC_1');
          let cleaningStatus = { status: 'Sin Servicio', class: 'bg-red-50 text-red-800 border-red-300' };
          if (ec1) {
            if (ec1.score === 2) {
              cleaningStatus = { status: 'Básico', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
            } else if (ec1.score === 1) {
              cleaningStatus = { status: 'Limitado', class: 'bg-amber-50 text-amber-800 border-amber-300' };
            }
          }

          return {
            water: waterStatus,
            sanitation: sanitationStatus,
            waste: wasteStatus,
            hygiene: hygieneStatus,
            cleaning: cleaningStatus
          };
        });

        // Computed property to calculate points on 7-Axis SVG Radar Chart dynamically
        // Optimized center, scale, and multi-line label metrics for image_e6dfa2.png
        const radarChartData = computed(() => {
          const cx = 375;
          const cy = 240;
          const rMax = 150; // Boosted scale from 100 to 150 (50% larger)
          const angles = [0, 1, 2, 3, 4].map(i => (i * 2 * Math.PI / 5) - Math.PI / 2);
          
          // Outer and inner concentric levels (heptagons)
          const levels = [20, 40, 60, 80, 100].map(levelPercent => {
            const r = rMax * (levelPercent / 100);
            return angles.map(angle => ({
              x: cx + r * Math.cos(angle),
              y: cy + r * Math.sin(angle)
            }));
          });

          // Radial axes line connecting levels
          const axes = angles.map(angle => ({
            x1: cx,
            y1: cy,
            x2: cx + rMax * Math.cos(angle),
            y2: cy + rMax * Math.sin(angle)
          }));

          // Points based on compliance percentage for each of the 7 modules
          const points = modulesList.map((mod, i) => {
            const pct = getModulePercentage(mod.name);
            const r = rMax * (pct / 100);
            const angle = angles[i];
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            
            // Outer placement radius for label (with comfortable padding)
            const labelRadius = rMax + 18;
            let lx = cx + labelRadius * Math.cos(angle);
            let ly = cy + labelRadius * Math.sin(angle);
            
            // Adjust label horizontal and vertical alignments based on trigonometric quadrant
            let anchor = 'middle';
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            if (cos > 0.2) {
              anchor = 'start';
            } else if (cos < -0.2) {
              anchor = 'end';
            } else {
              anchor = 'middle';
            }

            // Adjust y offset based on vertical quadrant for 2 lines
            if (sin < -0.9) { // top-most (Agua)
              ly -= 10;
            } else if (sin > 0.9) { // bottom-most (Limpieza / Higiene de manos)
              ly += 12;
            } else if (sin < 0) { // upper half
              ly -= 5;
            } else { // lower half
              ly += 5;
            }

            return {
              x,
              y,
              lx,
              ly,
              anchor,
              pct,
              label: mod.name,
              color: mod.hex
            };
          });

          const polygonString = points.map(p => `${p.x},${p.y}`).join(' ');

          return {
            cx,
            cy,
            rMax,
            levels,
            axes,
            points,
            polygonString
          };
        });

        // Dynamic Title for Header
        const getViewTitle = computed(() => {
          switch (activeView.value) {
            case 'instructions': return 'Instrucciones y Metodología';
            case 'general': return 'Paso 1: Datos Generales del Establecimiento';
            case 'assessment': return 'Paso 2: Evaluación de la Situación';
            case 'step3': return 'Paso 3: Evaluación del Riesgo';
            case 'step4': return 'Paso 4: Plan de Mejora';
            case 'step5': return 'Paso 5: Monitoreo y Revisión del Plan';
            case 'dashboard': return 'Resumen';
            default: return 'WASH-FIT Suite';
          }
        });

        const getActiveModuleName = computed(() => {
          const found = modulesList.find(d => d.id === activeModuleTab.value);
          return found ? found.name : 'Agua';
        });

        // Set score dynamically and initialize risk defaults if gap
        const setIndicatorScore = (ind, score) => {
          ind.score = score;
          if (score === 0 || score === 1) {
            if (!ind.problemDesc) {
              ind.problemDesc = `Se detectó incumplimiento parcial/total en el indicador ${ind.code}: ${ind.title}.`;
            }
            if (!ind.associatedRisks) {
              ind.associatedRisks = `Riesgos potenciales sobre la salud de los pacientes, seguridad clínica y la equidad del servicio.`;
            }
            if (!ind.severity) ind.severity = 3;
            if (!ind.likelihood) ind.likelihood = 3;
          }
          triggerToast(`Indicador ${ind.code} puntuado con éxito (${score} pts).`, 'success');
          
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // Quantitative Module Analytics
        const getModuleTotalCount = (moduleName) => {
          return indicators.value.filter(i => i.module === moduleName).length;
        };

        const getModuleAnsweredCount = (moduleName) => {
          return indicators.value.filter(i => i.module === moduleName && i.score !== null).length;
        };

        const getModuleScoreAchieved = (moduleName) => {
          return indicators.value
            .filter(i => i.module === moduleName && i.score !== null)
            .reduce((sum, i) => sum + i.score, 0);
        };

        const getModulePercentage = (moduleName) => {
          const answered = getModuleAnsweredCount(moduleName);
          if (answered === 0) return 0;
          const score = getModuleScoreAchieved(moduleName);
          return Math.round((score / (answered * 2)) * 100);
        };

        // Navigate between tabs smoothly
        const navigateNextModule = () => {
          const currentIndex = modulesList.findIndex(d => d.id === activeModuleTab.value);
          const nextIndex = (currentIndex + 1) % modulesList.length;
          activeModuleTab.value = modulesList[nextIndex].id;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          triggerToast(`Navegando al módulo: ${modulesList[nextIndex].name}`, 'success');
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // Reset and clear evaluation and risk records for the current active module
        const clearCurrentModule = () => {
          const currentModuleName = getActiveModuleName.value;
          const moduleIndicators = indicators.value.filter(i => i.module === currentModuleName);
          
          moduleIndicators.forEach(ind => {
            ind.score = null;
            ind.notes = '';
            ind.problemDesc = '';
            ind.associatedRisks = '';
            ind.severity = 3;
            ind.likelihood = 3;
            ind.action = '';
            ind.targetDate = '';
            ind.resources = '';
            ind.responsible = '';
            ind.cost = null;
            ind.trackingStatus = 'No Iniciado';
            ind.revisionNotes = '';
          });
          
          triggerToast(`Se ha eliminado todo el llenado y seleccionado para el Módulo de ${currentModuleName}.`, 'success');
          
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // Helper functions for Risk assessment
        const getRiskColorClass = (score) => {
          if (score >= 15) return 'bg-red-50 text-red-900 border-red-300';
          if (score >= 8) return 'bg-amber-50 text-amber-900 border-amber-300';
          return 'bg-emerald-50 text-emerald-900 border-emerald-300';
        };

        const getRiskLabel = (score) => {
          if (score >= 15) return 'Extremo';
          if (score >= 8) return 'Moderado';
          return 'Bajo';
        };

        // Step 5 specific helpers
        const getStatusColorClass = (status) => {
          if (status === 'Completado') return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
          if (status === 'En Progreso') return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
          if (status === 'Retrasado') return 'bg-red-50 text-red-800 border-red-300 font-bold';
          return 'bg-paho-card text-paho-gray-dark border-paho-grid';
        };

        const formatDate = (dateStr) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length !== 3) return dateStr;
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        // Manage Team Members with strict Confirmation, Edit & Delete capabilities
        const addTeamMember = () => {
          generalInfo.value.team.push({
            name: '',
            role: '',
            institution: '',
            responsibility: '',
            isEditing: true // Starts in edit mode so they can type in columns instantly
          });
          triggerToast('Fila de integrante creada. Llene los datos y haga clic en "Confirmar".', 'success');
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        const confirmTeamMember = (index) => {
          const member = generalInfo.value.team[index];
          if (!member.name.trim()) {
            triggerToast('El nombre del integrante es obligatorio.', 'error');
            return;
          }
          member.isEditing = false; // Locks the inputs and displays clean text with modify tools
          triggerToast('Integrante confirmado y guardado en el equipo.', 'success');
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        const editTeamMember = (index) => {
          generalInfo.value.team[index].isEditing = true; // Unlocks fields for edits
          triggerToast('Modificando registro del integrante.', 'success');
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        const removeTeamMember = (index) => {
          generalInfo.value.team.splice(index, 1);
          triggerToast('Integrante removido del equipo.', 'error');
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // =========================================================
        // GESTIÓN REAL DE REGISTRO FOTOGRÁFICO
        // =========================================================
        
        // 1. Simulación del click sobre el input file invisible
        const triggerMockUpload = () => {
          const fileInputElement = document.getElementById('real-file-input');
          if (fileInputElement) {
            fileInputElement.click();
          }
        };

        // 2. Procesador y validador de archivos reales subidos
        const handleFileChange = (event) => {
          const files = event.target.files;
          if (!files || files.length === 0) return;

          Array.from(files).forEach(file => {
            // Validar que el archivo sea una imagen
            if (!file.type.startsWith('image/')) {
              triggerToast(`El archivo "${file.name}" no es una imagen válida.`, 'error');
              return;
            }
            // Validar que no supere el tamaño máximo de 5MB
            if (file.size > 5 * 1024 * 1024) {
              triggerToast(`La imagen "${file.name}" supera el límite de 5MB.`, 'error');
              return;
            }

            // Crear objeto de imagen con su URL Blob temporal
            const photoObject = {
              name: file.name,
              file: file, // Guardamos el archivo binario real por si lo necesitas
              url: URL.createObjectURL(file) // URL temporal para la previsualización inmediata
            };

            // Lo agregamos directamente a tu array reactivo existente
            generalInfo.value.photos.push(photoObject);
          });

          triggerToast('Evidencia fotográfica cargada exitosamente.', 'success');
          
          // Reseteamos el input para poder subir el mismo archivo si se elimina
          event.target.value = '';

          // Forzar refresco de los iconos Lucide si existiesen en la lista nueva
          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // 3. Eliminador físico del archivo liberando la memoria
        const removePhoto = (index) => {
          const photo = generalInfo.value.photos[index];
          if (photo && photo.url && photo.url.startsWith('blob:')) {
            URL.revokeObjectURL(photo.url); // Evita fugas de memoria en el navegador
          }
          generalInfo.value.photos.splice(index, 1);
          triggerToast('Evidencia fotográfica removida.', 'error');
        };

        // Export data to local JSON file
        const exportData = () => {
          const dataset = {
            generalInfo: generalInfo.value,
            indicators: indicators.value
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataset, null, 2));
          const downloadAnchor = document.createElement('a');
          downloadAnchor.setAttribute("href", dataStr);
          downloadAnchor.setAttribute("download", `WASH_FIT_Evaluacion_${generalInfo.value.facilityName.replace(/\s+/g, '_')}.json`);
          document.body.appendChild(downloadAnchor);
          downloadAnchor.click();
          downloadAnchor.remove();
          triggerToast('Configuración y evaluación exportada exitosamente.', 'success');
        };

        // Import data from local JSON file
        const importData = (event) => {
          const file = event.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const imported = JSON.parse(e.target.result);
              if (imported.generalInfo && imported.indicators) {
                // Ensure historical imported data gets mapped correctly with editing flags
                if (imported.generalInfo.team) {
                  imported.generalInfo.team.forEach(t => {
                    if (t.isEditing === undefined) t.isEditing = false;
                  });
                }
                // Backwards compatibility for tracking fields
                imported.indicators.forEach(ind => {
                  if (ind.trackingStatus === undefined) ind.trackingStatus = 'No Iniciado';
                  if (ind.revisionNotes === undefined) ind.revisionNotes = '';
                  if (ind.associatedRisks === undefined) ind.associatedRisks = '';
                });
                generalInfo.value = imported.generalInfo;
                indicators.value = imported.indicators;
                triggerToast('Evaluación e importación completa.', 'success');
                nextTick(() => {
                  if (window.lucide) window.lucide.createIcons();
                });
              } else {
                triggerToast('El archivo no tiene el formato estándar de WASH-FIT.', 'error');
              }
            } catch (err) {
              triggerToast('Error al procesar el archivo JSON importado.', 'error');
            }
          };
          reader.readAsText(file);
        };

        // View Navigator with Icon Refresh Guard
        const switchView = (viewName) => {
          activeView.value = viewName;
          mobileMenuOpen.value = false;

          // Si regresa a la pestaña general, forzamos que Leaflet reajuste su tamaño en el DOM visible
          if (viewName === 'general') {
            nextTick(() => {
              if (mapInstance) {
                mapInstance.invalidateSize();
                // Opcionalmente centrar en el marcador actual
                if (generalInfo.value.latitude && generalInfo.value.longitude) {
                  mapInstance.setView([generalInfo.value.latitude, generalInfo.value.longitude], mapInstance.getZoom());
                }
              } else {
                initMap();
              }
            });
          }

          nextTick(() => {
            if (window.lucide) window.lucide.createIcons();
          });
        };

        // Native System Print View Execution
        const printReport = () => {
          window.print();
        };

        // Map setup (Leaflet API match for image_056419.jpg)
        let mapInstance = null;
        let markerInstance = null;

        // Mapa:
        const initMap = () => {
          if (!window.L) return;

          nextTick(() => {
            const mapDom = document.getElementById('map-container');
            if (!mapDom) return;

            if (mapInstance) {
              mapInstance.invalidateSize();
              return;
            }

            // Usar coordenadas reactivas por defecto o las guardadas
            const latInit = generalInfo.value.latitude || -12.1485;
            const lngInit = generalInfo.value.longitude || -76.9841;

            mapInstance = L.map('map-container').setView([latInit, lngInit], 14);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(mapInstance);

            markerInstance = L.marker([latInit, lngInit], { draggable: true }).addTo(mapInstance);

            const updateCoordinates = (lat, lng) => {
              generalInfo.value.latitude = parseFloat(lat.toFixed(6));
              generalInfo.value.longitude = parseFloat(lng.toFixed(6));
            };

            // Al arrastrar el marcador
            markerInstance.on('dragend', (e) => {
              const pos = markerInstance.getLatLng();
              updateCoordinates(pos.lat, pos.lng);
            });

            // Al hacer clic en el mapa
            mapInstance.on('click', (e) => {
              markerInstance.setLatLng(e.latlng);
              updateCoordinates(e.latlng.lat, e.latlng.lng);
            });
          });
        };

        // Nueva función para cuando el usuario escribe a mano en los inputs numéricos
        const onCoordinatesInput = () => {
          const lat = parseFloat(generalInfo.value.latitude);
          const lng = parseFloat(generalInfo.value.longitude);

          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            if (mapInstance && markerInstance) {
              markerInstance.setLatLng([lat, lng]);
              mapInstance.setView([lat, lng], mapInstance.getZoom());
            }
          }
        };

          // Auto-run initialization
          onMounted(() => {
            if (window.lucide) {
              window.lucide.createIcons();
            }
            // Start the map on load if starting on general view, else switchView takes care of it
            if (activeView.value === 'general') {
              initMap();
            }
          });

        return {
          activeView,
          activeModuleTab,
          mobileMenuOpen,
          sidebarCollapsed, // <-- Agrega esta línea
          filterOnlyGaps,
          toast,
          modulesList,
          generalInfo,
          indicators,
          answeredCount,
          progressPercentage,
          totalGaps,
          totalScoreAchieved,
          overallCompliance,
          getFilteredIndicatorsByModule,
          getActiveModuleProgressPercentage,
          getSortedGaps,
          jmpCalculatedStatus,
          radarChartData,
          getViewTitle,
          getActiveModuleName,
          setIndicatorScore,
          getModuleTotalCount,
          getModuleAnsweredCount,
          getModuleScoreAchieved,
          getModulePercentage,
          navigateNextModule,
          getRiskColorClass,
          getRiskLabel,
          addTeamMember,
          confirmTeamMember,
          editTeamMember,
          removeTeamMember,
         
          triggerMockUpload, // Mantenemos el mismo nombre para no romper otras partes del HTML
          handleFileChange,  // Nueva función agregada
          removePhoto,       // Función modificada

          exportData,
          importData,
          switchView,
          printReport,
          clearCurrentModule,
          onCoordinatesInput,
          trackingSummary,
          planProgressPercentage,
          getStatusColorClass,
          formatDate,
          
          focusedCostId,
          formatThousands,
          updateCost

        };
      }
    }).mount('#app');
