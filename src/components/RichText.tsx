import React from 'react';

interface RichTextProps {
    content?: string;
    className?: string;
    truncate?: boolean;
}

export const RichText: React.FC<RichTextProps> = ({ content, className, truncate }) => {
    if (!content) return null;

    // Split content into lines
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];

    let currentListType: 'ul' | 'ol' | null = null;
    let currentListItems: React.ReactNode[] = [];

    const flushList = () => {
        if (currentListType === 'ul') {
            elements.push(
                <ul key={`ul-${elements.length}`} className="rt-list ul">
                    {currentListItems}
                </ul>
            );
        } else if (currentListType === 'ol') {
            elements.push(
                <ol key={`ol-${elements.length}`} className="rt-list ol">
                    {currentListItems}
                </ol>
            );
        }
        currentListType = null;
        currentListItems = [];
    };

    // If truncated, we only process the first line
    const processLines = truncate ? lines.slice(0, 1) : lines;
    const hasMore = lines.length > 1;

    processLines.forEach((line, index) => {
        const trimmed = line.trim();

        // Unordered List (- or *)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (currentListType === 'ol') flushList();
            currentListType = 'ul';
            const text = trimmed.substring(2);
            currentListItems.push(<li key={`li-${index}`}>{text}</li>);
        }
        // Ordered List (1. )
        else if (/^\d+\.\s/.test(trimmed)) {
            if (currentListType === 'ul') flushList();
            currentListType = 'ol';
            const text = trimmed.replace(/^\d+\.\s/, '');
            currentListItems.push(<li key={`li-${index}`}>{text}</li>);
        }
        // Normal Text
        else {
            flushList();
            if (trimmed === '') {
                // If truncated and it's independent, show nothing? 
                // Using <br> will just be empty height.
                elements.push(<br key={`br-${index}`} />);
            } else {
                elements.push(
                    <div key={`p-${index}`} className="rt-paragraph">
                        {line}
                    </div>
                );
            }
        }
    });

    flushList();

    return (
        <div className={`rich-text-content ${truncate ? 'truncated' : ''} ${className || ''}`}>
            {elements}
            {truncate && hasMore && (
                <span className="rt-more-indicator">...</span>
            )}
        </div>
    );
};
