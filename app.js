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
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all';
let currentSort = 'date';

// Theme Management
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const currentTheme = localStorage.getItem('theme');
if (currentTheme === 'dark' || (!currentTheme && prefersDarkScheme.matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

// Event Listeners
todoForm.addEventListener('submit', addTodo);
todoList.addEventListener('click', handleTodoClick);
filterButtons.forEach(button => button.addEventListener('click', handleFilter));
sortSelect.addEventListener('change', handleSort);
clearCompletedBtn.addEventListener('click', clearCompleted);
themeToggle.addEventListener('click', toggleTheme);
shortcutsToggle.addEventListener('click', toggleShortcuts);
document.addEventListener('keydown', handleKeyboardShortcuts);

// Functions
function addTodo(e) {
    e.preventDefault();
    const text = todoInput.value.trim();
    
    if (!text) {
        showError(todoInput, 'Task cannot be empty!');
        return;
    }

    if (isDuplicate(text)) {
        showError(todoInput, 'Task already exists!');
        return;
    }

    const todo = {
        id: Date.now(),
        text,
        completed: false,
        completedAt: null,
        priority: prioritySelect.value,
        createdAt: new Date().toISOString(),
        date: new Date().toISOString()
    };

    todos.push(todo);
    saveTodos();
    renderTodos();
    todoForm.reset();
    todoInput.focus();
}

function handleTodoClick(e) {
    const item = e.target.closest('.todo-item');
    if (!item) return;

    const id = parseInt(item.dataset.id);
    const todo = todos.find(t => t.id === id);

    if (e.target.matches('.delete-btn')) {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
    } else if (e.target.matches('.edit-btn')) {
        startEditing(item, todo);
    } else if (e.target.matches('.toggle-btn')) {
        todo.completed = !todo.completed;
        todo.completedAt = todo.completed ? new Date().toISOString() : null;
        saveTodos();
        renderTodos();
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
            <input type="text" class="edit-input" value="${text}">
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

        const handleSave = () => {
            const newText = editInput.value.trim();
            if (!newText) {
                showError(editInput, 'Task cannot be empty!');
                return;
            }

            if (isDuplicate(newText) && newText !== todo.text) {
                showError(editInput, 'Task already exists!');
                return;
            }

            todo.text = newText;
            todo.priority = editPriority.value;
            saveTodos();
            renderTodos();
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
    renderTodos();
}

function handleSort() {
    currentSort = sortSelect.value;
    renderTodos();
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
    // Add new todo
    if (e.key === 'Enter' && document.activeElement === todoInput) {
        return; // Let the form handle this
    }

    // Toggle dark mode
    if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
    }

    // Toggle shortcuts modal
    if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleShortcuts();
    }
}

function showError(element, message) {
    element.classList.add('error');
    const existingError = element.parentElement.querySelector('.error-message');
    
    if (!existingError) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.setAttribute('role', 'alert');
        element.parentElement.appendChild(errorDiv);
    }

    setTimeout(() => {
        element.classList.remove('error');
        const errorDiv = element.parentElement.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }, 3000);
}

function isDuplicate(text) {
    return todos.some(todo => todo.text.toLowerCase() === text.toLowerCase());
}

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Helper function to format dates
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

// Helper function to calculate time difference
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
                    <span class="todo-text">${todo.text}</span>
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

// Initial render
renderTodos(); 