import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './RichTextEditor.css';

const RichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = 'Start typing...', 
  disabled = false,
  minHeight = '200px',
  maxHeight = '400px',
  showToolbar = true,
  className = ''
}) => {
  const [content, setContent] = useState(value);
  const [isExpanded, setIsExpanded] = useState(false);
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    setContent(value);
  }, [value]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
    }
  }, []);

  const handleContentChange = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      if (onChange) {
        onChange(newContent);
      }
    }
  };

  const executeCommand = (command, value = null) => {
    if (disabled) return;
    
    document.execCommand(command, false, value);
    editorRef.current.focus();
    handleContentChange();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    
    // Handle common shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          executeCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          executeCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          executeCommand('underline');
          break;
        default:
          break;
      }
    }
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      executeCommand('createLink', url);
    }
  };

  const formatBlock = (tag) => {
    executeCommand('formatBlock', `<${tag}>`);
  };

  const isCommandActive = (command) => {
    try {
      return document.queryCommandState(command);
    } catch (e) {
      return false;
    }
  };

  const toolbarButtons = [
    {
      id: 'bold',
      icon: 'format_bold',
      title: 'Bold (Ctrl+B)',
      command: 'bold',
      active: isCommandActive('bold')
    },
    {
      id: 'italic',
      icon: 'format_italic',
      title: 'Italic (Ctrl+I)',
      command: 'italic',
      active: isCommandActive('italic')
    },
    {
      id: 'underline',
      icon: 'format_underlined',
      title: 'Underline (Ctrl+U)',
      command: 'underline',
      active: isCommandActive('underline')
    },
    {
      id: 'separator1',
      type: 'separator'
    },
    {
      id: 'unorderedList',
      icon: 'format_list_bulleted',
      title: 'Bullet List',
      command: 'insertUnorderedList',
      active: isCommandActive('insertUnorderedList')
    },
    {
      id: 'orderedList',
      icon: 'format_list_numbered',
      title: 'Numbered List',
      command: 'insertOrderedList',
      active: isCommandActive('insertOrderedList')
    },
    {
      id: 'separator2',
      type: 'separator'
    },
    {
      id: 'link',
      icon: 'link',
      title: 'Insert Link',
      onClick: insertLink
    },
    {
      id: 'separator3',
      type: 'separator'
    },
    {
      id: 'h1',
      text: 'H1',
      title: 'Heading 1',
      onClick: () => formatBlock('h1')
    },
    {
      id: 'h2',
      text: 'H2',
      title: 'Heading 2',
      onClick: () => formatBlock('h2')
    },
    {
      id: 'h3',
      text: 'H3',
      title: 'Heading 3',
      onClick: () => formatBlock('h3')
    },
    {
      id: 'p',
      text: 'P',
      title: 'Paragraph',
      onClick: () => formatBlock('p')
    }
  ];

  return (
    <div className={`rich-text-editor ${className} ${disabled ? 'disabled' : ''}`}>
      {showToolbar && (
        <div className="rte-toolbar" ref={toolbarRef}>
          {toolbarButtons.map((button) => {
            if (button.type === 'separator') {
              return <div key={button.id} className="toolbar-separator" />;
            }

            return (
              <button
                key={button.id}
                type="button"
                className={`toolbar-button ${button.active ? 'active' : ''}`}
                title={button.title}
                disabled={disabled}
                onClick={button.onClick || (() => executeCommand(button.command))}
                onMouseDown={(e) => e.preventDefault()}
              >
                {button.icon && (
                  <span className="material-icons">{button.icon}</span>
                )}
                {button.text && (
                  <span className="button-text">{button.text}</span>
                )}
              </button>
            );
          })}
          
          <div className="toolbar-spacer" />
          
          <button
            type="button"
            className="toolbar-button expand-button"
            title={isExpanded ? 'Collapse' : 'Expand'}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="material-icons">
              {isExpanded ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      )}
      
      <div 
        className={`rte-editor ${isExpanded ? 'expanded' : ''}`}
        style={{
          minHeight: isExpanded ? '60vh' : minHeight,
          maxHeight: isExpanded ? 'none' : maxHeight
        }}
      >
        <div
          ref={editorRef}
          contentEditable={!disabled}
          className="editor-content"
          onInput={handleContentChange}
          onKeyDown={handleKeyDown}
          onPaste={handleContentChange}
          suppressContentEditableWarning={true}
          data-placeholder={placeholder}
        />
      </div>
      
      <div className="rte-footer">
        <div className="character-count">
          {editorRef.current ? editorRef.current.textContent.length : 0} characters
        </div>
      </div>
    </div>
  );
};

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  minHeight: PropTypes.string,
  maxHeight: PropTypes.string,
  showToolbar: PropTypes.bool,
  className: PropTypes.string
};

export default RichTextEditor;