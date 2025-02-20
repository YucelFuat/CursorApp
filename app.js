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

// DOM Elements
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const prioritySelect = document.getElementById('priority-select');
const todoList = document.getElementById('todo-list');
const filterButtons = document.querySelectorAll('.filter-group button');
const sortSelect = document.getElementById('sort-select');
const tasksCount = document.getElementById('tasks-count');
const clearCompletedBtn = document.getElementById('clear-completed');
const themeToggle = document.getElementById('theme-toggle');
const shortcutsToggle = document.getElementById('shortcuts-toggle');
const shortcutsModal = document.querySelector('.shortcuts-modal');

// State
let todos = Storage.load('todos', []);
let currentFilter = 'all';
let currentSort = 'date';

// Theme Management
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark' || (!currentTheme && prefersDarkScheme.matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

function showError(element, message) {
    if (element) {
        element.classList.add('error');
    }
    
    const container = element ? element.parentElement : document.querySelector('.container');
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
    return todos.some(todo => todo.text.toLowerCase() === text.toLowerCase());
}

function saveTodos() {
    if (!Storage.save('todos', todos)) {
        showError(null, 'Unable to save data. Local storage might be full.');
    }
}

// API Functions
const API = {
    baseUrl: 'http://localhost:3000/api',
    
    async getAllTasks() {
        const response = await fetch(`${this.baseUrl}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
    },
    
    async createTask(taskData) {
        const response = await fetch(`${this.baseUrl}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData),
        });
        if (!response.ok) throw new Error('Failed to create task');
        return response.json();
    },
    
    async updateTask(id, taskData) {
        const response = await fetch(`${this.baseUrl}/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData),
        });
        if (!response.ok) throw new Error('Failed to update task');
        return response.json();
    },
    
    async deleteTask(id) {
        const response = await fetch(`${this.baseUrl}/tasks/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete task');
        return response.json();
    }
};

// Main Functions
async function loadTasks() {
    try {
        todos = await API.getAllTasks();
        renderTodos();
    } catch (error) {
        showError(null, 'Failed to load tasks');
        console.error('Error loading tasks:', error);
    }
}

async function addTodo(e) {
    e.preventDefault();
    const text = todoInput.value.trim();
    
    const validation = validateInput(text);
    if (!validation.valid) {
        showError(todoInput, validation.error);
        return;
    }

    try {
        const newTask = await API.createTask({
            task_name: text,
            priority: prioritySelect.value
        });
        
        todos.push(newTask);
        renderTodos();
        todoForm.reset();
        todoInput.focus();
    } catch (error) {
        showError(todoInput, 'Failed to create task');
        console.error('Error creating task:', error);
    }
}

async function handleTodoClick(e) {
    const item = e.target.closest('.todo-item');
    if (!item) return;

    const id = parseInt(item.dataset.id);
    const todo = todos.find(t => t.id === id);

    try {
        if (e.target.matches('.delete-btn')) {
            await API.deleteTask(id);
            todos = todos.filter(t => t.id !== id);
            renderTodos();
        } else if (e.target.matches('.edit-btn')) {
            startEditing(item, todo);
        } else if (e.target.matches('.toggle-btn')) {
            const newStatus = todo.status === 'completed' ? 'ongoing' : 'completed';
            const updatedTask = await API.updateTask(id, {
                status: newStatus,
                priority: todo.priority,
                task_name: todo.task_name
            });
            
            const index = todos.findIndex(t => t.id === id);
            todos[index] = updatedTask;
            renderTodos();
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
            renderTodos();
        }
    });

    if (!wasEditing) {
        item.classList.add('editing');
        const content = item.querySelector('.todo-content');
        const text = todo.text;
        content.innerHTML = `
            <input type="text" class="edit-input" value="${escapeHtml(text)}">
            <select class="edit-priority">
                <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>High</option>
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
                
                const index = todos.findIndex(t => t.id === todo.id);
                todos[index] = updatedTask;
                renderTodos();
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
                renderTodos();
            }
        });
    }
}

function handleFilter(e) {
    filterButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    debouncedRender();
}

function handleSort() {
    currentSort = sortSelect.value;
    debouncedRender();
}

function clearCompleted() {
    todos = todos.filter(todo => !todo.completed);
    saveTodos();
    renderTodos();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    themeToggle.innerHTML = newTheme === 'dark' 
        ? '<i class="fas fa-sun"></i>' 
        : '<i class="fas fa-moon"></i>';
}

function toggleShortcuts() {
    const isHidden = shortcutsModal.hidden;
    shortcutsModal.hidden = !isHidden;
    shortcutsToggle.setAttribute('aria-expanded', !isHidden);
}

function handleKeyboardShortcuts(e) {
    if (e.key === 'Enter' && document.activeElement === todoInput) {
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

function renderTodos() {
    let filteredTodos = todos.filter(todo => {
        if (currentFilter === 'active') return !todo.completed;
        if (currentFilter === 'completed') return todo.completed;
        return true;
    });

    filteredTodos.sort((a, b) => {
        if (currentSort === 'priority') {
            const priorityOrder = { high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        } else {
            return new Date(b.date) - new Date(a.date);
        }
    });

    todoList.innerHTML = filteredTodos.map(todo => `
        <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <div class="todo-content">
                <button class="toggle-btn" aria-label="${todo.completed ? 'Mark as incomplete' : 'Mark as complete'}">
                    <i class="fas ${todo.completed ? 'fa-check-circle' : 'fa-circle'}"></i>
                </button>
                <div class="todo-info">
                    <span class="todo-text">${escapeHtml(todo.text)}</span>
                    <div class="todo-dates">
                        <span class="date-info">
                            <i class="fas fa-calendar"></i> Created: ${formatDate(todo.createdAt)}
                        </span>
                        ${todo.completed ? `
                            <span class="date-info completion-info">
                                <i class="fas fa-check"></i> Completed: ${formatDate(todo.completedAt)}
                                <span class="duration">
                                    <i class="fas fa-clock"></i> Duration: ${getTimeDifference(todo.createdAt, todo.completedAt)}
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
    `).join('');

    const activeTodos = todos.filter(todo => !todo.completed).length;
    tasksCount.textContent = `${activeTodos} task${activeTodos !== 1 ? 's' : ''} left`;
}

const debouncedRender = debounce(renderTodos, 150);

// Event Listeners
todoForm.addEventListener('submit', addTodo);
todoList.addEventListener('click', handleTodoClick);
filterButtons.forEach(button => button.addEventListener('click', handleFilter));
sortSelect.addEventListener('change', handleSort);
clearCompletedBtn.addEventListener('click', clearCompleted);
themeToggle.addEventListener('click', toggleTheme);
shortcutsToggle.addEventListener('click', toggleShortcuts);
document.addEventListener('keydown', handleKeyboardShortcuts);

// Initial load
loadTasks(); 