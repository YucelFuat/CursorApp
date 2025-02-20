// Storage handling
const Storage = {
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    load: function(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    },

    clear: function(key) {
        localStorage.removeItem(key);
    }
};

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function getTimeDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    
    return result.length > 0 ? result.join(' ') : 'just now';
}

// Cache DOM elements
const elements = {
    todoForm: document.getElementById('todo-form'),
    todoInput: document.getElementById('todo-input'),
    prioritySelect: document.getElementById('priority-select'),
    todoList: document.getElementById('todo-list'),
    filterButtons: document.querySelectorAll('.filter-group button'),
    sortSelect: document.getElementById('sort-select'),
    tasksCount: document.getElementById('tasks-count'),
    clearCompletedBtn: document.getElementById('clear-completed'),
    themeToggle: document.getElementById('theme-toggle'),
    shortcutsToggle: document.getElementById('shortcuts-toggle'),
    shortcutsModal: document.querySelector('.shortcuts-modal'),
    container: document.querySelector('.container')
};

// Constants
const PRIORITIES = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

const STATUSES = {
    ONGOING: 'ongoing',
    COMPLETED: 'completed'
};

// Error handling utility
class AppError extends Error {
    constructor(message, type = 'error') {
        super(message);
        this.type = type;
    }
}

// State management
const state = {
    todos: [],
    currentFilter: 'all',
    currentSort: 'date',
    
    setTodos(newTodos) {
        this.todos = newTodos;
        this.persist();
    },

    addTodo(todo) {
        this.todos.unshift(todo);
        this.persist();
    },

    updateTodo(id, updatedTodo) {
        const index = this.todos.findIndex(t => t.id === id);
        if (index !== -1) {
            this.todos[index] = updatedTodo;
            this.persist();
        }
    },

    deleteTodo(id) {
        this.todos = this.todos.filter(t => t.id !== id);
        this.persist();
    },

    persist() {
        Storage.save('todos', this.todos);
    },

    getFilteredAndSortedTodos() {
        let filtered = this.todos.filter(todo => {
            if (this.currentFilter === 'active') return todo.status === 'ongoing';
            if (this.currentFilter === 'completed') return todo.status === 'completed';
            return true;
        });

        return filtered.sort((a, b) => {
            if (this.currentSort === 'priority') {
                const priorityOrder = { high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return new Date(b.created_date) - new Date(a.created_date);
        });
    }
};

// Theme Management
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark' || (!currentTheme && prefersDarkScheme.matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

function showError(element, message) {
    if (element) {
        element.classList.add('error');
    }
    
    const container = element ? element.parentElement : elements.container;
    const existingError = container.querySelector('.error-message');
    
    if (!existingError) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.setAttribute('role', 'alert');
        container.appendChild(errorDiv);
    }

    setTimeout(() => {
        if (element) {
            element.classList.remove('error');
        }
        const errorDiv = container.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }, 3000);
}

function validateInput(text) {
    if (text.length < 1) return { valid: false, error: 'Task cannot be empty!' };
    if (text.length > 200) return { valid: false, error: 'Task is too long! Maximum 200 characters.' };
    if (isDuplicate(text)) return { valid: false, error: 'Task already exists!' };
    return { valid: true };
}

function isDuplicate(text) {
    return state.todos.some(todo => todo.task_name.toLowerCase() === text.toLowerCase());
}

function saveTodos() {
    if (!Storage.save('todos', state.todos)) {
        showError(null, 'Unable to save data. Local storage might be full.');
    }
}

// API service with retry mechanism
const API = {
    baseUrl: 'http://localhost:3000/api',
    maxRetries: 3,
    retryDelay: 1000,

    async request(endpoint, options = {}) {
        let lastError;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                const response = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new AppError(error.error || 'API request failed');
                }

                return await response.json();
            } catch (err) {
                lastError = err;
                if (i < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (i + 1)));
                }
            }
        }
        throw lastError;
    },

    async getAllTasks() {
        return this.request('/tasks');
    },

    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    },

    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    },

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE'
        });
    }
};

// UI update functions
const UI = {
    showError(element, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.setAttribute('role', 'alert');

        if (element) {
            element.classList.add('error');
            element.parentElement.appendChild(errorDiv);
        } else {
            elements.container.appendChild(errorDiv);
        }

        setTimeout(() => {
            if (element) element.classList.remove('error');
            errorDiv.remove();
        }, 3000);
    },

    updateTaskCount() {
        const activeTodos = state.todos.filter(todo => todo.status !== STATUSES.COMPLETED).length;
        elements.tasksCount.textContent = `${activeTodos} task${activeTodos !== 1 ? 's' : ''} left`;
    },

    renderTodoItem(todo) {
        return `
            <li class="todo-item ${todo.status === STATUSES.COMPLETED ? 'completed' : ''}" data-id="${todo.id}">
                <div class="todo-content">
                    <button class="toggle-btn" aria-label="${todo.status === STATUSES.COMPLETED ? 'Mark as incomplete' : 'Mark as complete'}">
                        <i class="fas ${todo.status === STATUSES.COMPLETED ? 'fa-check-circle' : 'fa-circle'}"></i>
                    </button>
                    <div class="todo-info">
                        <span class="todo-text">${escapeHtml(todo.task_name)}</span>
                        <div class="todo-dates">
                            <span class="date-info">
                                <i class="fas fa-calendar"></i> Created: ${formatDate(todo.created_date)}
                            </span>
                            ${todo.status === STATUSES.COMPLETED ? `
                                <span class="date-info completion-info">
                                    <i class="fas fa-check"></i> Completed: ${formatDate(todo.completed_date)}
                                    <span class="duration">
                                        <i class="fas fa-clock"></i> Duration: ${formatInterval(todo.completion_duration)}
                                    </span>
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <span class="priority-badge priority-${todo.priority}">${todo.priority}</span>
                </div>
                <div class="todo-actions">
                    <button class="edit-btn" aria-label="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" aria-label="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </li>
        `;
    },

    render() {
        const todos = state.getFilteredAndSortedTodos();
        elements.todoList.innerHTML = todos.map(this.renderTodoItem).join('');
        this.updateTaskCount();
    }
};

// Event handlers
async function handleAddTodo(e) {
    e.preventDefault();
    const text = elements.todoInput.value.trim();
    
    const validation = validateInput(text);
    if (!validation.valid) {
        showError(elements.todoInput, validation.error);
        return;
    }

    try {
        const newTask = await API.createTask({
            task_name: text,
            priority: elements.prioritySelect.value
        });
        
        state.addTodo(newTask);
        UI.render();
        elements.todoForm.reset();
        elements.todoInput.focus();
    } catch (error) {
        showError(elements.todoInput, 'Failed to create task');
        console.error('Error creating task:', error);
    }
}

async function handleTodoClick(e) {
    const item = e.target.closest('.todo-item');
    if (!item) return;

    const id = parseInt(item.dataset.id);
    const todo = state.todos.find(t => t.id === id);

    try {
        if (e.target.matches('.delete-btn')) {
            await API.deleteTask(id);
            state.deleteTodo(id);
            UI.render();
        } else if (e.target.matches('.edit-btn')) {
            startEditing(item, todo);
        } else if (e.target.matches('.toggle-btn')) {
            const newStatus = todo.status === STATUSES.COMPLETED ? STATUSES.ONGOING : STATUSES.COMPLETED;
            const updatedTask = await API.updateTask(id, {
                status: newStatus,
                priority: todo.priority,
                task_name: todo.task_name
            });
            
            state.updateTodo(id, updatedTask);
            UI.render();
        }
    } catch (error) {
        showError(null, 'Failed to update task');
        console.error('Error updating task:', error);
    }
}

function startEditing(item, todo) {
    const wasEditing = item.classList.contains('editing');
    // Remove any other editing states
    document.querySelectorAll('.editing').forEach(el => {
        if (el !== item) {
            el.classList.remove('editing');
            UI.render();
        }
    });

    if (!wasEditing) {
        item.classList.add('editing');
        const content = item.querySelector('.todo-content');
        const text = todo.task_name;
        content.innerHTML = `
            <input type="text" class="edit-input" value="${escapeHtml(text)}">
            <select class="edit-priority">
                <option value="low" ${todo.priority === PRIORITIES.LOW ? 'selected' : ''}>Low</option>
                <option value="medium" ${todo.priority === PRIORITIES.MEDIUM ? 'selected' : ''}>Medium</option>
                <option value="high" ${todo.priority === PRIORITIES.HIGH ? 'selected' : ''}>High</option>
            </select>
            <button class="save-btn" aria-label="Save changes">
                <i class="fas fa-check"></i>
            </button>
        `;

        const editInput = content.querySelector('.edit-input');
        const editPriority = content.querySelector('.edit-priority');
        const saveBtn = content.querySelector('.save-btn');

        editInput.focus();
        editInput.setSelectionRange(text.length, text.length);

        const handleSave = async () => {
            const newText = editInput.value.trim();
            if (!newText) {
                showError(editInput, 'Task cannot be empty!');
                return;
            }

            try {
                const updatedTask = await API.updateTask(todo.id, {
                    task_name: newText,
                    priority: editPriority.value,
                    status: todo.status
                });
                
                state.updateTodo(todo.id, updatedTask);
                UI.render();
            } catch (error) {
                showError(editInput, 'Failed to update task');
                console.error('Error updating task:', error);
            }
        };

        saveBtn.addEventListener('click', handleSave);
        editInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                handleSave();
            } else if (e.key === 'Escape') {
                UI.render();
            }
        });
    }
}

function handleFilter(e) {
    const button = e.target.closest('button');  // Get the clicked button
    if (!button) return;  // If no button was clicked, return

    elements.filterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    state.currentFilter = button.dataset.filter;
    UI.render();  // Render immediately instead of using debounced version
}

function handleSort() {
    state.currentSort = elements.sortSelect.value;
    debouncedRender();
}

async function clearCompleted() {
    try {
        // Get all completed tasks
        const completedTasks = state.todos.filter(todo => todo.status === 'completed');
        
        // Delete each completed task using the API
        for (const task of completedTasks) {
            await API.deleteTask(task.id);
            state.deleteTodo(task.id);
        }
        
        UI.render();
    } catch (error) {
        showError(null, 'Failed to clear completed tasks');
        console.error('Error clearing completed tasks:', error);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    elements.themeToggle.innerHTML = newTheme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
}

function toggleShortcuts() {
    const isHidden = elements.shortcutsModal.hidden;
    elements.shortcutsModal.hidden = !isHidden;
    elements.shortcutsToggle.setAttribute('aria-expanded', !isHidden);
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'Enter' && document.activeElement === elements.todoInput) {
        return; // Let the form handle this
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleShortcuts();
    }
}

function formatInterval(interval) {
    if (!interval) return 'N/A';
    
    // Log the interval to see its structure
    console.log('Interval:', interval);
    
    // Check if the interval is already a string
    if (typeof interval === 'string') {
        return interval
            .replace(/mons?/, 'month(s)')
            .replace(/days?/, 'd')
            .replace(/hours?/, 'h')
            .replace(/mins?/, 'm')
            .replace(/secs?/, 's')
            .replace(/years?/, 'year(s)');
    }
    
    // If it's an object, try to format it manually
    let duration = '';
    
    if (interval.years) duration += `${interval.years}y `;
    if (interval.months) duration += `${interval.months}m `;
    if (interval.days) duration += `${interval.days}d `;
    if (interval.hours) duration += `${interval.hours}h `;
    if (interval.minutes) duration += `${interval.minutes}m `;
    if (interval.seconds) duration += `${interval.seconds}s`;
    
    return duration.trim() || 'just now';
}

const debouncedRender = debounce(UI.render, 150);

// Initialize app
async function initializeApp() {
    try {
        const tasks = await API.getAllTasks();
        state.setTodos(tasks);
        UI.render();
        
        // Event listeners
        elements.todoForm.addEventListener('submit', handleAddTodo);
        elements.todoList.addEventListener('click', handleTodoClick);
        elements.filterButtons.forEach(button => {
            button.addEventListener('click', handleFilter);
        });
        elements.sortSelect.addEventListener('change', handleSort);
        elements.clearCompletedBtn.addEventListener('click', clearCompleted);
        elements.themeToggle.addEventListener('click', toggleTheme);
        elements.shortcutsToggle.addEventListener('click', toggleShortcuts);
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
    } catch (error) {
        showError(null, 'Failed to initialize app. Please refresh the page.');
        console.error('Initialization error:', error);
    }
}

// Start the app
document.addEventListener('DOMContentLoaded', initializeApp);

// Example of how API calls should look
async function getTasks() {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        // Handle the data
    } catch (error) {
        console.error('Error:', error);
    }
}

async function addTask(taskData) {
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData)
        });
        const data = await response.json();
        // Handle the response
    } catch (error) {
        console.error('Error:', error);
    }
} 