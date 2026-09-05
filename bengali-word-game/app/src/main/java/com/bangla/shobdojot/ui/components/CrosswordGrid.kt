package com.bangla.shobdojot.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.bangla.shobdojot.model.GridPos
import com.bangla.shobdojot.model.Puzzle
import com.bangla.shobdojot.ui.theme.Marigold
import com.bangla.shobdojot.ui.theme.SlateViolet
import com.bangla.shobdojot.ui.theme.TileInk

/**
 * The crossword board. Unsolved slots are dark plates; solved and hinted letters flip up
 * in marigold. Cell size follows whatever space the caller allows, so a 2x3 level and a
 * 3x6 level both fit on screen without scrolling.
 */
@Composable
fun CrosswordGrid(
    puzzle: Puzzle,
    revealed: Set<GridPos>,
    modifier: Modifier = Modifier,
    maxCellSize: Dp = 68.dp
) {
    if (puzzle.rows == 0 || puzzle.cols == 0) return

    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val gap = 5.dp
        val byWidth = (maxWidth - gap * (puzzle.cols - 1)) / puzzle.cols
        val byHeight = (maxHeight - gap * (puzzle.rows - 1)) / puzzle.rows
        val cell = minOf(byWidth, byHeight, maxCellSize)

        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
            for (row in 0 until puzzle.rows) {
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    for (col in 0 until puzzle.cols) {
                        val pos = GridPos(row, col)
                        val letter = puzzle.cellLetters[pos]
                        if (letter == null) {
                            Box(Modifier.size(cell))
                        } else {
                            GridCell(letter = letter, revealed = pos in revealed, size = cell)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GridCell(letter: String, revealed: Boolean, size: Dp) {
    val progress by animateFloatAsState(
        targetValue = if (revealed) 1f else 0f,
        animationSpec = tween(durationMillis = 320),
        label = "reveal"
    )

    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(percent = 22))
            .background(lerp(SlateViolet, Marigold, progress)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = letter,
            color = TileInk,
            // Conjuncts need vertical room, so small cells get a proportionally larger glyph.
            fontSize = (size.value * if (size.value < 40f) 0.5f else 0.42f).sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier
                .alpha(progress)
                .scale(0.6f + 0.4f * progress)
        )
    }
}
